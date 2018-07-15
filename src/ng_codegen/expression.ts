/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 17/06/2018
 */
import * as Long from "long";
import {
    AssignmentExpression,
    BinaryExpression,
    CastExpression,
    ExpressionResult,
    FloatingConstant,
    Identifier,
    IntegerConstant,
    ParenthesisExpression,
    SubscriptExpression,
    UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {
    AddressType,
    FunctionEntity,
    PointerType,
    PrimitiveTypes,
    Type,
} from "../common/type";
import {I32Unary, WType, WUnaryOperation} from "../wasm";
import {BinaryOperator, getOpFromStr} from "../wasm/constant";
import {WBinaryOperation, WConst} from "../wasm/expression";
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

    // TODO:: 暂时不支持
    //  对于初始化表达式 支持常量初始化到data段
    // if (this.isInitExpr
    //     && this.left instanceof Identifier
    //     && right.form === ExpressionResultType.CONSTANT
    //     && (right.type instanceof IntegerType ||
    //         right.type instanceof FloatingType ||
    //         right.type.equals(PrimitiveTypes.__ccharptr))) {
    //     const item = this.left.codegen(ctx);
    //     if (item.form === ExpressionResultType.LVALUE_MEMORY_DATA) {
    //         return doVarInit(ctx, item, right);
    //     }
    // }

    const left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);

    if (!left.isLeft || !(left.expr instanceof WAddressHolder)) {
        throw new SyntaxError(`could not assign to a right value`, this);
    }

    if (right.expr instanceof FunctionEntity) {
        throw new SyntaxError(`could not assign a function name`, this);
    }

    ctx.submitStatement(left.expr.createStore(left.type.toWType(),
        doConversion(left.type, right, this).fold()));

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

// StringLiteral.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
//     ctx.currentNode = this;
//     return {
//         type: PrimitiveTypes.__ccharptr,
//         form: ExpressionResultType.CONSTANT,
//         value: ctx.memory.allocString(this.value),
//     };
// };
//
// CharacterConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
//     ctx.currentNode = this;
//     return {
//         type: PrimitiveTypes.char,
//         form: ExpressionResultType.CONSTANT,
//         value: Long.fromInt(this.value.charCodeAt(0)),
//     };
// };

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

    return {
        type: dstType,
        isLeft: false,
        expr: new WBinaryOperation(
            op as BinaryOperator,
            doConversion(dstType, left, this),
            doConversion(dstType, right, this),
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
        const newExpr = doValueTransform(expr, this);
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
            expr: expr.expr.createLoadAddress(),
        };
    } else if ( this.operator === "+") {
        return doValueTransform(this.operand.codegen(ctx), this);
    } else if ( this.operator === "-") {
        return new BinaryExpression(this.location, "-",
            IntegerConstant.getZero(),
            this.operand,
        ).codegen(ctx);
    } else if ( this.operator === "!") {
        const value = doConversion(PrimitiveTypes.int32, this.operand.codegen(ctx), this);
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

// export function doVarInit(ctx: CompileContext, left: ExpressionResult,
//                           right: ExpressionResult): ExpressionResult {
//     // charptr, int, double
//     const leftValue = left.value as number;
//     if (right.type.equals(PrimitiveTypes.__ccharptr)) {
//         if (!(left.type.equals(PrimitiveTypes.__charptr)) && !(left.type.equals(PrimitiveTypes.__ccharptr)) ) {
//             throw new SyntaxError(`unsupport init from ${left.type} to ${right.type}`, ctx.currentNode!);
//         }
//         ctx.memory.data.setUint32(leftValue, right.value as number);
//     }
//     let rightValue = right.value as number;
//     if (right.type instanceof IntegerType) {
//         rightValue = (right.value as Long).toNumber();
//     }
//     if (left.type instanceof UnsignedCharType) {
//         ctx.memory.data.setUint8(leftValue, rightValue);
//     } else if (left.type instanceof CharType) {
//         ctx.memory.data.setInt8(leftValue, rightValue);
//     } else if (left.type instanceof UnsignedInt16Type) {
//         ctx.memory.data.setUint16(leftValue, rightValue);
//     } else if (left.type instanceof UnsignedInt32Type) {
//         ctx.memory.data.setUint32(leftValue, rightValue);
//     } else if (left.type instanceof UnsignedInt64Type) {
//         if (right.type instanceof IntegerType) {
//             ctx.memory.data.setUint32(leftValue, (right.value as Long).high);
//             ctx.memory.data.setUint32(leftValue + 4, (right.value as Long).low);
//         } else {
//             ctx.memory.data.setUint32(leftValue, rightValue >> 32);
//             ctx.memory.data.setUint32(leftValue + 4, rightValue);
//         }
//     } else if (left.type instanceof Int16Type) {
//         ctx.memory.data.setInt16(leftValue, rightValue);
//     } else if (left.type instanceof Int32Type) {
//         ctx.memory.data.setInt32(leftValue, rightValue);
//     } else if (left.type instanceof Int64Type) {
//         if (right.type instanceof IntegerType) {
//             ctx.memory.data.setInt32(leftValue, (right.value as Long).high);
//             ctx.memory.data.setInt32(leftValue + 4, (right.value as Long).low);
//         } else {
//             ctx.memory.data.setInt32(leftValue, rightValue >> 32);
//             ctx.memory.data.setInt32(leftValue + 4, rightValue);
//         }
//     } else if (left.type instanceof FloatType) {
//         ctx.memory.data.setFloat32(leftValue, rightValue);
//     } else if (left.type instanceof DoubleType) {
//         ctx.memory.data.setFloat64(leftValue, rightValue);
//     } else {
//         throw new InternalError(`unsupport type assignment`);
//     }
//     return left;
// }

CastExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const type = this.deduceType(ctx);
    const expr = this.operand.codegen(ctx);
    return {
        type,
        expr: doConversion(type, expr, this, true),
        isLeft: false,
    };
};

// PostfixExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
//     const ope = this.operand.codegen(ctx);
//     loadIntoStack(ctx, ope);
//     recycleExpressionResult(ctx, new AssignmentExpression(this.location,
//          "=", this.operand, new BinaryExpression(
//              this.location, this.decrement ? "-" : "+", this.operand, IntegerConstant.getOne(),
//         )).codegen(ctx));
//     return {
//         form: ExpressionResultType.RVALUE,
//         type: ope.type,
//         value: 0,
//     };
// };

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
