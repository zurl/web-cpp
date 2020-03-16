import * as Long from "long";
import {InternalError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType, LeftReferenceType, PointerType} from "../../type/compound_type";
import {
    CharType,
    DoubleType,
    FloatingType,
    FloatType,
    Int16Type,
    Int32Type,
    Int64Type,
    IntegerType,
    PrimitiveTypes,
    UnsignedCharType,
    UnsignedInt16Type,
    UnsignedInt32Type,
    UnsignedInt64Type,
} from "../../type/primitive_type";
import {WConst, WExpression, WGetAddress, WMemoryLocation} from "../../wasm";
import {WAddressHolder} from "../address";
import {MemberExpression} from "../class/member_expression";
import {CompileContext} from "../context";
import {CallExpression} from "../function/call_expression";
import {isFunctionExists} from "../overload";
import {TypeConverter} from "../type_converter";
import {BinaryExpression} from "./binary_expression";
import {Expression, ExpressionResult} from "./expression";
import {Identifier} from "./identifier";
import {IntegerConstant} from "./integer_constant";
import {UnaryExpression} from "./unary_expression";

const __charptr = new PointerType(new CharType());
const __ccharptr = new PointerType(new CharType());

export class AssignmentExpression extends Expression {
    public operator: string;
    public left: Expression;
    public right: Expression;
    public isInitExpr: boolean;

    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        this.operator = operator;
        this.left = left;
        this.right = right;
        this.isInitExpr = false;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
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
                        Identifier.fromString(this.location, "#=")),
                    [
                        this.right]).codegen(ctx);
            } else {
                // totally wrong fuck itself
                if (rightType.equals(leftType)) {
                    const len = leftType.length;
                    return new CallExpression(this.location, Identifier.fromString(this.location, "::memcpy"), [
                        new UnaryExpression(this.location, "&", this.left),
                        new UnaryExpression(this.location, "&", this.right),
                        new IntegerConstant(this.location, 10, Long.fromInt(len), len.toString(), null),
                    ]).codegen(ctx);
                } else {
                    const ctorName = leftType.fullName + "::#" + leftType.shortName;
                    const callee = Identifier.fromString(this.location, ctorName);
                    return new CallExpression(this.location, callee, [
                        new UnaryExpression(this.location, "&", this.left),
                        this.right,
                    ]).codegen(ctx);
                }
            }
        }

        let left = this.left.codegen(ctx);
        const right = this.right.codegen(ctx);

        // reference binding
        if (this.isInitExpr && left.type instanceof LeftReferenceType) {
            this.doReferenceBinding(ctx, right);
            return left;
        }

        left = new TypeConverter(left).removeReference(ctx);

        if (!(left.expr instanceof WAddressHolder)) {
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
                    right.expr.constant);
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

        /*
        if (!this.isInitExpr && left.type.isConst) {
            throw new SyntaxError(`could not assign to const variable`, this);
        }
        */

        const storeExpr = new TypeConverter(right).tryConvertTo(ctx, left.type).expr;
        ctx.submitStatement(left.expr.createStore(ctx, left.type, storeExpr));
        return left;
    }

    public deduceType(ctx: CompileContext): Type {
        return this.left.deduceType(ctx);
    }

    public doReferenceBinding(ctx: CompileContext, src: ExpressionResult) {
        if (!(this.left instanceof Identifier)) {
            throw new InternalError(`you can only bind to an identifer`);
        }

        const lookupName = this.left.getLookupName(ctx);
        const dst = ctx.scopeManager.lookup(lookupName);
        if (!(dst instanceof Variable && dst.type instanceof LeftReferenceType)) {
            throw new InternalError(`you can only bind to an reference`);
        }
        const dstExpr = new WAddressHolder(dst.location, dst.addressType, this.location);

        if ( src.type instanceof LeftReferenceType ) {
            const sr = src.type.elementType;
            const dr = dst.type.elementType;

            if ( sr instanceof ClassType && dr instanceof ClassType) {
                if ( !sr.isSubClassOf(dr) ) {
                    throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
                }
            } else {
                if ( !src.type.elementType.equals(dst.type.elementType)) {
                    throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
                }
            }

            if (!(src.expr instanceof WAddressHolder)) {
                throw new InternalError(`you could only bind to a left value`);
            }

            ctx.submitStatement(dstExpr.createStore(ctx, PrimitiveTypes.uint32,
                src.expr.createLoadAddress(ctx)));
        } else {
            const sr = src.type;
            const dr = dst.type.elementType;

            if ( sr instanceof ClassType && dr instanceof ClassType) {
                if ( !sr.isSubClassOf(dr) ) {
                    throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
                }
            } else {
                if ( !src.type.equals(dst.type.elementType)) {
                    throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
                }
            }
            if (!(src.expr instanceof WAddressHolder)) {
                throw new InternalError(`you could only bind from a left value`);
            }

            ctx.submitStatement(dstExpr.createStore(ctx, PrimitiveTypes.uint32,
                src.expr.createLoadAddress(ctx)));
        }

    }

}

export function doVarInit(ctx: CompileContext, leftType: Type, rightType: Type,
                          leftValue: number, rightValue: string) {
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
