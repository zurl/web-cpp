import {InternalError, SyntaxError, TypeError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {
    ArithmeticType,
    FloatingType,
    Int64Type,
    IntegerType,
    PrimitiveTypes,
    UnsignedInt64Type, UnsignedIntegerType,
} from "../../type/primitive_type";
import {BinaryOperator, getOpFromStr, I32Binary, WBinaryOperation, WConst, WType} from "../../wasm";
import {MemberExpression} from "../class/member_expression";
import {CompileContext} from "../context";
import {CallExpression} from "../function/call_expression";
import {TypeConverter} from "../type_converter";
import {Expression, ExpressionResult, recycleExpressionResult} from "./expression";
import {Identifier} from "./identifier";

export class BinaryExpression extends Expression {
    public operator: string;
    // + - * / % & | && || < > <= >= == !=
    public left: Expression;
    public right: Expression;

    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        if (typeof operator[1] === "undefined") { // HACK: for rule '&'!'&' this will receive ["&", undefined]
            this.operator = operator[0];
        } else {
            this.operator = operator;
        }
        this.left = left;
        this.right = right;
    }

    public codegen(ctx: CompileContext): ExpressionResult {

        if (this.operator === ",") {
            recycleExpressionResult(ctx, this.left.codegen(ctx));
            return this.right.codegen(ctx);
        }

        const leftType = this.left.deduceType(ctx);
        const rightType = this.right.deduceType(ctx);

        if (leftType instanceof ClassType) {
            return new CallExpression(this.location,
                new MemberExpression(this.location, this.left, false,
                    Identifier.fromString(this.location, "#" + this.operator)),
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
                left = new TypeConverter(left).toRValue(ctx);
                left = {
                    type: dstType,
                    expr: new WBinaryOperation(I32Binary.mul, left.expr,
                        new WConst(WType.u32, dstType.elementType.length.toString(), this.location), this.location),
                };
            } else if (right.type instanceof IntegerType) {
                right = new TypeConverter(right).toRValue(ctx);
                right = {
                    type: dstType,
                    expr: new WBinaryOperation(I32Binary.mul, right.expr,
                        new WConst(WType.u32, dstType.elementType.length.toString(), this.location), this.location),
                };
            }
        }

        let leftExpr = new TypeConverter(left).tryConvertTo(ctx, dstType).expr;
        let rightExpr = new TypeConverter(right).tryConvertTo(ctx, dstType).expr;

        if (this.operator === "&&" || this.operator === "||") {
            leftExpr = new WBinaryOperation(I32Binary.ne, leftExpr,
                new WConst(WType.i32, "0", this.location), this.location);
            rightExpr = new WBinaryOperation(I32Binary.ne, rightExpr,
                new WConst(WType.i32, "0", this.location), this.location);
        }

        return {
            type: dstType,
            expr: new WBinaryOperation(
                op as BinaryOperator,
                leftExpr,
                rightExpr,
                this.location,
            ),
        };
    }

    public deduceType(ctx: CompileContext): Type {
        const left = TypeConverter.fromType(this.left.deduceType(ctx)).toRValue(ctx).type;
        const right = TypeConverter.fromType(this.right.deduceType(ctx)).toRValue(ctx).type;

        if (left instanceof ClassType) {
            return new CallExpression(this.location,
                new MemberExpression(this.location, this.left, false,
                    Identifier.fromString(this.location, "#" + this.operator)),
                [this.right]).deduceType(ctx);
        }

        if ("+-*%/".includes(this.operator)) {
            if (left instanceof ArithmeticType && right instanceof ArithmeticType) {
                return arithmeticDeduce(left, right);
            } else if (left instanceof PointerType || right instanceof PointerType) {
                if (left instanceof PointerType && right instanceof PointerType) {
                    throw new TypeError(`could not apply ope on two pointer`, this);
                }
                if (left instanceof PointerType) {
                    if (!(right instanceof IntegerType)) {
                        throw new TypeError(`could not apply ${right.toString()} to pointer`, this);
                    }
                    return left;
                } else if (right instanceof PointerType) {
                    if (!(left instanceof IntegerType)) {
                        throw new TypeError(`could not apply ${left.toString()} to pointer`, this);
                    }
                    if (this.operator === "-") {
                        throw new TypeError(`could - a pointer`, this);
                    }
                    return right;
                } else {
                    throw new TypeError(`bad operator on pointer`, this);
                }
            } else {
                throw new TypeError(`could not apply ${this.operator} on ${left.toString()}`
                    + ` and ${right.toString()}`, this);
            }
        } else if ([">=", "<=", ">", "<", "==", "!="].includes(this.operator)) {
            if (left instanceof ArithmeticType && right instanceof ArithmeticType) {
                return PrimitiveTypes.bool;
            }
            if (left instanceof PointerType && right instanceof PointerType) {
                return PrimitiveTypes.bool;
            }
            throw new TypeError(`unsupport relation compute`, this);
        } else if (["&&", "||"].includes(this.operator)) {
            return PrimitiveTypes.bool;
        } else if (["&", "|", "^", ">>", "<<"].includes(this.operator)) {
            if ( !( left instanceof IntegerType && right instanceof IntegerType)) {
                throw new TypeError(`binary operator could only be applied on integer`, this);
            }
            return PrimitiveTypes.int32;
        } else if (this.operator === ",") {
            return this.right.deduceType(ctx);
        }
        throw new InternalError(`no impl at BinaryExpression()`);
    }

}

export function arithmeticDeduce(left: ArithmeticType, right: ArithmeticType): ArithmeticType {
    if (left instanceof FloatingType || right instanceof FloatingType) {
        return PrimitiveTypes.double;
    }
    if (left instanceof UnsignedInt64Type || right instanceof UnsignedInt64Type) {
        return PrimitiveTypes.uint64;
    }
    if (left instanceof Int64Type || right instanceof Int64Type) {
        return PrimitiveTypes.int64;
    }
    if (left instanceof UnsignedIntegerType || right instanceof UnsignedIntegerType) {
        return PrimitiveTypes.uint32;
    }
    return PrimitiveTypes.int32;
}
