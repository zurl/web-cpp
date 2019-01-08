/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 17/06/2018
 */
import * as Long from "long";
import {
    AssignmentExpression,
    BinaryExpression, CallExpression,
    CastExpression, CharacterConstant, ConditionalExpression,
    ExpressionResult,
    FloatingConstant, Identifier,
    IntegerConstant, MemberExpression,
    Node,
    ParenthesisExpression, PostfixExpression, StringLiteral,
    SubscriptExpression, TemplateFuncInstanceIdentifier,
    UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {AddressType} from "../common/symbol";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {ArrayType, LeftReferenceType, PointerType, ReferenceType} from "../type/compound_type";
import {UnresolvedFunctionOverloadType} from "../type/function_type";
import {
    CharType,
    DoubleType, FloatingType,
    FloatType, Int16Type,
    Int32Type,
    Int64Type, IntegerType,
    PrimitiveTypes, UnsignedCharType, UnsignedInt16Type,
    UnsignedInt32Type,
    UnsignedInt64Type,
} from "../type/primitive_type";
import {I32Binary, I32Unary, WType, WUnaryOperation} from "../wasm";
import {BinaryOperator, getOpFromStr} from "../wasm/constant";
import {WBinaryOperation, WConditionalExpression, WConst, WGetAddress, WMemoryLocation} from "../wasm/expression";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doConversion, doReferenceTransform, doValueTransform} from "./conversion";
import {isFunctionExists} from "./cpp/overload";
import {doReferenceBinding} from "./cpp/reference";
import {FunctionLookUpResult} from "./scope";
import {recycleExpressionResult} from "./statement";

ParenthesisExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return this.expression.codegen(ctx);
};

const __ccharptr = new PointerType(new CharType());
const __charptr = new PointerType(new CharType());
__charptr.isConst = true;

AssignmentExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if (this.operator !== "=") {
        const ope = this.operator.split("=")[0];
        this.operator = "=";
        this.right = new BinaryExpression(this.location,
            ope,
            this.left,
            this.right);
    }

    const leftType = this.left.deduceType(ctx);
    const rightType = this.right.deduceType(ctx);

    if (leftType instanceof ClassType) {
        const fullName = leftType.fullName + "::#=";
        if (isFunctionExists(ctx, fullName, [rightType], leftType)) {
            return new CallExpression(this.location,
                new MemberExpression(this.location, this.left, false,
                    new Identifier(this.location, "#=")),
                [
                    this.right]).codegen(ctx);
        } else {
            const len = leftType.length;
            return new CallExpression(this.location, new Identifier(this.location, "::memcpy"), [
                new UnaryExpression(this.location, "&", this.left),
                new UnaryExpression(this.location, "&", this.right),
                new IntegerConstant(this.location, 10, Long.fromInt(len), len.toString(), null),
            ]).codegen(ctx);
        }
    }

    let left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);

    // reference binding
    if (this.isInitExpr && left.type instanceof LeftReferenceType) {
        doReferenceBinding(ctx, left, right, this);
        return left;
    }

    left = doReferenceTransform(ctx, left, this);

    if (!left.isLeft || !(left.expr instanceof WAddressHolder)) {
        throw new SyntaxError(`could not assign to a right value`, this);
    }

    if (left.type instanceof ArrayType) {
        throw new SyntaxError(`unsupport array assignment`, this);
    }

    // 对于初始化表达式 支持常量初始化到data段
    if (this.isInitExpr && this.left instanceof Identifier &&
        left.expr.type === AddressType.MEMORY_DATA) {
        // int & float
        if (right.expr instanceof WConst &&
            (right.type instanceof IntegerType || right.type instanceof FloatingType)) {
            doVarInit(ctx, left.type, right.type, left.expr.place as number,
                right.expr.constant, this);
            return left;
        }
        // const char
        if (right.expr instanceof WGetAddress &&
            right.expr.form === WMemoryLocation.DATA &&
            right.type.equals(__ccharptr)) {
            if (!(left.type.equals(__charptr)) && !(left.type.equals(__ccharptr))) {
                throw new SyntaxError(`unsupport init from ${left.type} to ${right.type}`, this);
            }
            ctx.memory.data.setUint32(left.expr.place as number, right.expr.offset, true);
            return left;
        }
    }

    if (!this.isInitExpr && left.type.isConst) {
        throw new SyntaxError(`could not assign to const variable`, this);
    }

    ctx.submitStatement(left.expr.createStore(ctx, left.type,
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
        type: __ccharptr,
        expr,
        isLeft: false,
    };
};

CharacterConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return {
        type: PrimitiveTypes.char,
        expr: new WConst(WType.i32, this.value.charCodeAt(0).toString(), this.location),
        isLeft: false,
    };
};

Identifier.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if (this.name.charAt(0) === "#") {
        throw new SyntaxError(`illegal operator overload`, this);
    }
    const item = ctx.scopeManager.lookupAnyName(this.name);
    if (item === null) {
        const thisPtr = ctx.scopeManager.lookupShortName("this");
        if (thisPtr !== null) {
            try {
                return new MemberExpression(this.location, new Identifier(this.location, "this"),
                    true, this).codegen(ctx);
            } catch (e) {
                throw new SyntaxError(`Unresolve Name ${this.name}`, this);
            }
        } else {
            throw new SyntaxError(`Unresolve Name ${this.name}`, this);
        }
    }
    if (item instanceof Type) {
        throw new SyntaxError(`${this.name} expect to be variable, but it is a type :)`, this);
    }
    if (item instanceof FunctionLookUpResult) {
        // TODO:: overload lookupShortName
        return {
            type: PrimitiveTypes.void,
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

TemplateFuncInstanceIdentifier.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return {
        type: PrimitiveTypes.void,
        expr: (this.deduceType(ctx) as UnresolvedFunctionOverloadType).functionLookupResult,
        isLeft: false,
    };
};

BinaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {

    if (this.operator === ",") {
        recycleExpressionResult(ctx, this, this.left.codegen(ctx));
        return this.right.codegen(ctx);
    }

    const leftType = this.left.deduceType(ctx);
    const rightType = this.right.deduceType(ctx);

    if (leftType instanceof ClassType) {
        return new CallExpression(this.location,
            new MemberExpression(this.location, this.left, false,
                new Identifier(this.location, "#" + this.operator)),
            [this.right]).codegen(ctx);
    }

    if (rightType instanceof ClassType) {
        throw new SyntaxError(`current not support right overload`, this);
    }

    let left = this.left.codegen(ctx);
    let right = this.right.codegen(ctx);

    const dstType = this.deduceType(ctx);
    const op = getOpFromStr(this.operator, dstType.toWType());

    if (op === null) {
        throw new InternalError(`unsupport op ${this.operator}`);
    }

    if (dstType instanceof PointerType) {
        if (left.type instanceof IntegerType) {
            left = doValueTransform(ctx, left, this);
            if (left.expr instanceof FunctionLookUpResult) {
                throw new InternalError(`unsupport func name`);
            }
            left = {
                type: dstType,
                isLeft: false,
                expr: new WBinaryOperation(I32Binary.mul, left.expr,
                    new WConst(WType.u32, dstType.elementType.length.toString(), this.location)),
            };
        } else if (right.type instanceof IntegerType) {
            right = doValueTransform(ctx, right, this);
            if (right.expr instanceof FunctionLookUpResult) {
                throw new InternalError(`unsupport func name`);
            }
            right = {
                type: dstType,
                isLeft: false,
                expr: new WBinaryOperation(I32Binary.mul, right.expr,
                    new WConst(WType.u32, dstType.elementType.length.toString(), this.location)),
            };
        }
    }

    let leftExpr = doConversion(ctx, dstType, left, this);
    let rightExpr = doConversion(ctx, dstType, right, this);

    if (this.operator === "&&" || this.operator === "||") {
        leftExpr = new WBinaryOperation(I32Binary.ne, leftExpr,
            new WConst(WType.i32, "0", this.location), this.location);
        rightExpr = new WBinaryOperation(I32Binary.ne, rightExpr,
            new WConst(WType.i32, "0", this.location), this.location);
    }

    return {
        type: dstType,
        isLeft: false,
        expr: new WBinaryOperation(
            op as BinaryOperator,
            leftExpr,
            rightExpr,
            this.location,
        ),
    };
};

UnaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if (this.operator === "sizeof") {
        return {
            type: PrimitiveTypes.uint32,
            expr: new WConst(WType.u32,
                this.operand.deduceType(ctx).length.toString(),
                this.location,
            ),
            isLeft: false,
        };
    }

    const leftType = this.operand.deduceType(ctx);

    if (leftType instanceof ClassType) {
        const item = ctx.scopeManager.lookupFullName(
            leftType.fullName + "::#" + this.operator,
        );
        if (item != null) {
            return new CallExpression(this.location,
                new MemberExpression(this.location, this.operand, false,
                    new Identifier(this.location, "#" + this.operator)),
                []).codegen(ctx);
        }
    }

    if (this.operator === "++" || this.operator === "--") {
        return new AssignmentExpression(this.location,
            "=",
            this.operand,
            new BinaryExpression(this.location,
                this.operator.charAt(0),
                this.operand,
                IntegerConstant.getOne()))
            .codegen(ctx);
    }
    let expr = this.operand.codegen(ctx);
    if (this.operator === "*") {
        if (expr.type instanceof ReferenceType) {
            expr = doReferenceTransform(ctx, expr, this);
        }
        if (expr.type instanceof PointerType) {
            if (expr.expr instanceof FunctionLookUpResult) {
                throw new SyntaxError(`unsupport function name`, this);
            }
            return {
                isLeft: true,
                type: new LeftReferenceType(expr.type.elementType),
                expr: expr.expr,
            };
        } else {
            throw new SyntaxError(`you could not apply * on ${expr.type.toString()} `, this);
        }
    } else if (this.operator === "&") {
        if (!expr.isLeft || !(expr.expr instanceof WAddressHolder)) {
            throw new SyntaxError(`you could not get address of a right value `, this);
        }
        if (expr.type instanceof ArrayType) {
            expr.type = expr.type.elementType;
        }
        return {
            isLeft: false,
            type: new PointerType(expr.type),
            expr: expr.expr.createLoadAddress(ctx),
        };
    } else if (this.operator === "+") {
        return doValueTransform(ctx, this.operand.codegen(ctx), this);
    } else if (this.operator === "-") {
        return new BinaryExpression(this.location, "-",
            IntegerConstant.getZero(),
            this.operand,
        ).codegen(ctx);
    } else if (this.operator === "!") {
        const value = doConversion(ctx, PrimitiveTypes.int32, this.operand.codegen(ctx), this);
        return {
            type: PrimitiveTypes.int32,
            isLeft: false,
            expr: new WUnaryOperation(I32Unary.eqz, value, this.location),
        };
    } else if (this.operator === "~") {
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
    // arraybuffer is small endian, exchange required
    if (leftType instanceof UnsignedCharType) {
        ctx.memory.data.setUint8(leftValue, parseInt(rightValue));
    } else if (leftType instanceof CharType) {
        ctx.memory.data.setInt8(leftValue, parseInt(rightValue));
    } else if (leftType instanceof UnsignedInt16Type) {
        ctx.memory.data.setUint16(leftValue, parseInt(rightValue), true);
    } else if (leftType instanceof UnsignedInt32Type) {
        ctx.memory.data.setUint32(leftValue, parseInt(rightValue), true);
    } else if (leftType instanceof UnsignedInt64Type) {
        ctx.memory.data.setUint32(leftValue, Long.fromString(rightValue).low, true);
        ctx.memory.data.setUint32(leftValue + 4, Long.fromString(rightValue).low, true);
    } else if (leftType instanceof Int16Type) {
        ctx.memory.data.setInt16(leftValue, parseInt(rightValue), true);
    } else if (leftType instanceof Int32Type) {
        ctx.memory.data.setInt32(leftValue, parseInt(rightValue), true);
    } else if (leftType instanceof Int64Type) {
        ctx.memory.data.setInt32(leftValue, Long.fromString(rightValue).low);
        ctx.memory.data.setInt32(leftValue + 4, Long.fromString(rightValue).high, true);
    } else if (leftType instanceof FloatType) {
        ctx.memory.data.setFloat32(leftValue, parseFloat(rightValue), true);
    } else if (leftType instanceof DoubleType) {
        ctx.memory.data.setFloat64(leftValue, parseFloat(rightValue), true);
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

ConditionalExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const test = doConversion(ctx, PrimitiveTypes.int32, this.test.codegen(ctx), this);
    const targetType = this.deduceType(ctx);

    const left = this.consequent.codegen(ctx);
    const right = this.alternate.codegen(ctx);
    if (targetType instanceof ClassType) {
        const refType = new LeftReferenceType(targetType);
        return {
            type: refType,
            expr: new WAddressHolder(new WConditionalExpression(
                test,
                doConversion(ctx, refType, left, this, false, true),
                doConversion(ctx, refType, right, this, false, true),
            ), AddressType.RVALUE, this.location),
            isLeft: true,
        };
    } else {
        return {
            type: targetType,
            expr: new WConditionalExpression(
                test,
                doConversion(ctx, targetType, left, this),
                doConversion(ctx, targetType, right, this),
            ),
            isLeft: false,
        };
    }
};

export function expression() {
    return "";
}
