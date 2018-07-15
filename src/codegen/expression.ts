/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 17/06/2018
 */
import * as Long from "long";
import {
    AssignmentExpression,
    BinaryExpression,
    CastExpression, CharacterConstant,
    ExpressionResult,
    FloatingConstant, Identifier,
    IntegerConstant,
    Node,
    ParenthesisExpression, PostfixExpression, StringLiteral,
    SubscriptExpression,
    UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {
    AddressType, CharType, DoubleType, FloatingType, FloatType,
    FunctionEntity, Int16Type, Int32Type, Int64Type, IntegerType,
    PointerType,
    PrimitiveTypes,
    Type, UnsignedCharType, UnsignedInt16Type, UnsignedInt32Type, UnsignedInt64Type,
} from "../common/type";
import {I32Binary, I32Unary, WLoad, WType, WUnaryOperation} from "../wasm";
import {BinaryOperator, getOpFromStr} from "../wasm/constant";
import {WBinaryOperation, WConst, WGetAddress, WMemoryLocation} from "../wasm/expression";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doConversion, doValueTransform} from "./conversion";
import {recycleExpressionResult} from "./statement";

ParenthesisExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return this.expression.codegen(ctx);
};

AssignmentExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if (this.operator !== "=") {
        const ope = this.operator.split("=")[0];
        this.operator = "=";
        this.right = new BinaryExpression(this.location,
            ope,
            this.left,
            this.right);
    }

    const left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);

    if (!left.isLeft || !(left.expr instanceof WAddressHolder)) {
        throw new SyntaxError(`could not assign to a right value`, this);
    }

    if (right.expr instanceof FunctionEntity) {
        throw new SyntaxError(`could not assign a function name`, this);
    }

    // 对于初始化表达式 支持常量初始化到data段
    if (this.isInitExpr && this.left instanceof Identifier
        && right.expr instanceof WConst
        && (right.type instanceof IntegerType ||
            right.type instanceof FloatingType ||
            right.type.equals(PrimitiveTypes.__ccharptr))) {
        if (left.expr.type === AddressType.MEMORY_DATA) {
            doVarInit(ctx, left.type, right.type, left.expr.place as number,
                right.expr.constant, this);
            return left;
        }
    }

    ctx.submitStatement(left.expr.createStore(ctx, left.type.toWType(),
        doConversion(ctx, left.type, right, this).fold()));

    return left;
};

IntegerConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    let type = PrimitiveTypes.int32;
    if (this.suffix) {
        if (this.suffix.toUpperCase().indexOf("U") !== -1) {
            if (this.suffix.toUpperCase().indexOf("LL") !== -1) {
                type = PrimitiveTypes.uint64;
            } else {
                type = PrimitiveTypes.uint32;
            }
        } else {
            if (this.suffix.toUpperCase().indexOf("LL") !== -1) {
                type = PrimitiveTypes.int64;
            } else {
                type = PrimitiveTypes.int32;
            }
        }
    }
    return {
        type,
        expr: new WConst(type.toWType(), this.raw, this.location),
        isLeft: false,
    };
};

FloatingConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    let type = PrimitiveTypes.double;
    if (this.suffix && this.suffix.toUpperCase() === "f") {
        type = PrimitiveTypes.float;
    }
    return {
        type,
        expr: new WConst(type.toWType(), this.raw, this.location),
        isLeft: false,
    };
};

StringLiteral.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const expr = new WGetAddress(WMemoryLocation.DATA, this.location);
    expr.offset = ctx.memory.allocString(this.value);
    return {
        type: PrimitiveTypes.__ccharptr,
        expr,
        isLeft: false,
    };
};

CharacterConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return {
        type: PrimitiveTypes.char,
        expr: new WConst(WType.i8, this.value.charCodeAt(0).toString(), this.location),
        isLeft: false,
    };
};

Identifier.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const item = ctx.currentScope.get(this.name);
    if (item === null) {
        throw new SyntaxError(`Unresolve Name ${this.name}`, this);
    }
    if (item instanceof Type) {
        throw new SyntaxError(`${this.name} expect to be variable, but it is a type :)`, this);
    }
    if (item instanceof FunctionEntity) {
        return {
            type: item.type,
            expr: item,
            isLeft: false,
        };
    }

    return {
        type: item.type,
        expr: new WAddressHolder(item.location, item.addressType, this.location),
        isLeft: true,
    };
};

BinaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    // 救救刘人语小姐姐

    if ( this.operator === ",") {
        recycleExpressionResult(ctx, this, this.left.codegen(ctx));
        return this.right.codegen(ctx);
    }

    const left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);
    const dstType = this.deduceType(ctx);
    const op = getOpFromStr(this.operator, dstType.toWType());

    if ( op === null ) {
        throw new InternalError(`unsupport op ${this.operator}`);
    }

    if ( dstType instanceof PointerType ) {
        if ( left.type instanceof IntegerType ) {
            if ( left.expr instanceof FunctionEntity ) {
                throw new InternalError(`unsupportfunc name`);
            }
            left.type = dstType;
            left.expr = new WBinaryOperation(I32Binary.mul, left.expr,
                new WConst(WType.u32, dstType.elementType.length.toString(), this.location));
        } else if ( right.type instanceof IntegerType ) {
            if ( right.expr instanceof FunctionEntity ) {
                throw new InternalError(`unsupportfunc name`);
            }
            right.type = dstType;
            right.expr = new WBinaryOperation(I32Binary.mul, right.expr,
                new WConst(WType.u32, dstType.elementType.length.toString(), this.location));
        }
    }

    return {
        type: dstType,
        isLeft: false,
        expr: new WBinaryOperation(
            op as BinaryOperator,
            doConversion(ctx, dstType, left, this),
            doConversion(ctx, dstType, right, this),
            this.location,
        ),
    };
};

UnaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if ( this.operator === "sizeof") {
        return {
            type: PrimitiveTypes.uint32,
            expr: new WConst(WType.u32,
                this.operand.deduceType(ctx).length.toString(),
                this.location,
            ),
            isLeft: false,
        };
    } else if ( this.operator === "++" || this.operator === "--") {
        return new BinaryExpression(this.location,
            this.operator.charAt(0),
            this.operand,
            IntegerConstant.getOne())
            .codegen(ctx);
    }
    const expr = this.operand.codegen(ctx);
    if (this.operator === "*") {
        const newExpr = doValueTransform(ctx, expr, this);
        if (newExpr.type instanceof PointerType) {
            if ( newExpr.expr instanceof FunctionEntity) {
                throw new SyntaxError(`unsupport function name`, this);
            }
            return {
                isLeft: true,
                type: newExpr.type.elementType,
                expr: new WAddressHolder(newExpr.expr, AddressType.RVALUE,
                    this.location),
            };
        } else {
            throw new SyntaxError(`you could not apply * on ${expr.type.toString()} `, this);
        }
    } else if (this.operator === "&") {
        if ( !expr.isLeft || !(expr.expr instanceof WAddressHolder) ) {
            throw new SyntaxError(`you could not get address of a right value `, this);
        }
        return {
            isLeft: false,
            type: new PointerType(expr.type),
            expr: expr.expr.createLoadAddress(ctx),
        };
    } else if ( this.operator === "+") {
        return doValueTransform(ctx, this.operand.codegen(ctx), this);
    } else if ( this.operator === "-") {
        return new BinaryExpression(this.location, "-",
            IntegerConstant.getZero(),
            this.operand,
        ).codegen(ctx);
    } else if ( this.operator === "!") {
        const value = doConversion(ctx, PrimitiveTypes.int32, this.operand.codegen(ctx), this);
        return {
            type: PrimitiveTypes.int32,
            isLeft: false,
            expr: new WUnaryOperation(I32Unary.eqz, value, this.location),
        };
    } else if ( this.operator === "~") {
        return new BinaryExpression(this.location, "^",
            IntegerConstant.getNegOne(),
            this.operand,
        ).codegen(ctx);
    } else {
        throw new InternalError(`no_impl at unary ope=${this.operator}`);
    }
};

SubscriptExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return new UnaryExpression(
        this.location,
        "*",
        new BinaryExpression(
            this.location,
            "+",
            this.array,
            this.subscript,
        ),
    ).codegen(ctx);
};

export function doVarInit(ctx: CompileContext, leftType: Type, rightType: Type,
                          leftValue: number, rightValue: string, node: Node) {
    // charptr, int, double
    if (rightType.equals(PrimitiveTypes.__ccharptr)) {
        if (!(leftType.equals(PrimitiveTypes.__charptr)) && !(leftType.equals(PrimitiveTypes.__ccharptr)) ) {
            throw new SyntaxError(`unsupport init from ${leftType} to ${rightType}`, node);
        }
        ctx.memory.data.setUint32(leftValue, parseInt(rightValue));
    }
    if (leftType instanceof UnsignedCharType) {
        ctx.memory.data.setUint8(leftValue, parseInt(rightValue));
    } else if (leftType instanceof CharType) {
        ctx.memory.data.setInt8(leftValue, parseInt(rightValue));
    } else if (leftType instanceof UnsignedInt16Type) {
        ctx.memory.data.setUint16(leftValue, parseInt(rightValue));
    } else if (leftType instanceof UnsignedInt32Type) {
        ctx.memory.data.setUint32(leftValue, parseInt(rightValue));
    } else if (leftType instanceof UnsignedInt64Type) {
        ctx.memory.data.setUint32(leftValue, Long.fromString(rightValue).high);
        ctx.memory.data.setUint32(leftValue + 4, Long.fromString(rightValue).low);
    } else if (leftType instanceof Int16Type) {
        ctx.memory.data.setInt16(leftValue, parseInt(rightValue));
    } else if (leftType instanceof Int32Type) {
        ctx.memory.data.setInt32(leftValue, parseInt(rightValue));
    } else if (leftType instanceof Int64Type) {
        ctx.memory.data.setInt32(leftValue, Long.fromString(rightValue).high);
        ctx.memory.data.setInt32(leftValue + 4, Long.fromString(rightValue).low);
    } else if (leftType instanceof FloatType) {
        ctx.memory.data.setFloat32(leftValue, parseFloat(rightValue));
    } else if (leftType instanceof DoubleType) {
        ctx.memory.data.setFloat64(leftValue, parseFloat(rightValue));
    } else {
        throw new InternalError(`unsupport type assignment`);
    }
}

CastExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const type = this.deduceType(ctx);
    const expr = this.operand.codegen(ctx);
    return {
        type,
        expr: doConversion(ctx, type, expr, this, true),
        isLeft: false,
    };
};

PostfixExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const ope = this.operand.codegen(ctx);
    if (!ope.isLeft || !(ope.expr instanceof WAddressHolder)) {
        throw new SyntaxError(`your could not ++ a left value`, this);
    }
    recycleExpressionResult(ctx, this, new AssignmentExpression(this.location,
         "=", this.operand, new BinaryExpression(
             this.location, this.decrement ? "-" : "+", this.operand, IntegerConstant.getOne(),
        )).codegen(ctx));
    return ope;
};

// ConditionalExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
//     const test = this.test.codegen(ctx);
//     const targetType = extractRealType(this.deduceType(ctx));
//     loadIntoStack(ctx, test);
//     const t0 = ctx.currentBuilder.now;
//     ctx.build(OpCode.JZ, 0);
//     const con = this.consequent.codegen(ctx);
//     loadIntoStack(ctx, con);
//     convertTypeOnStack(ctx, targetType, extractRealType(con.type));
//     const t1 = ctx.currentBuilder.now;
//     ctx.build(OpCode.J, 0);
//     const t2 = ctx.currentBuilder.now;
//     ctx.currentBuilder.codeView.setUint32(t0 + 1, t2 - t0);
//     const alt = this.alternate.codegen(ctx);
//     loadIntoStack(ctx, alt);
//     convertTypeOnStack(ctx, targetType, extractRealType(alt.type));
//     const t3 = ctx.currentBuilder.now;
//     ctx.currentBuilder.codeView.setUint32(t1 + 1, t3 - t1);
//     return {
//         type: targetType,
//         form: ExpressionResultType.RVALUE,
//         value: 0,
//     };
// };

/*
 *  规定：
 *  对于Type value的值是存值的地方的地址
 *  对于Lref value的值是存指针的地方的地址    （rval的话，stop是指针本体
 *  对于pointer value的值是存指针的地方的地址 （rval的话，stop是指针本体
 *
 *  所以 push
 *  ptr/type lvalue => laddr, lmtype
 *  ptr/type rvalue => none
 *  lref lvalue => laddr, lm32, lmtype
 *  lref rvalue => lm32, lmtype
 *
 *  &a的话 {type: ptr(int32), form: rvalue, value=> x 不是指针的地址，却是指针的值
 *
 *
 */

export function expression() {
    return "";
}
