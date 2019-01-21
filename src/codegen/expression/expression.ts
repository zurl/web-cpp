import * as Long from "long";
import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {
    ArithmeticType,
    CharType, DoubleType, FloatType, Int16Type, Int32Type, Int64Type,
    PrimitiveTypes,
    UnsignedCharType,
    UnsignedInt16Type,
    UnsignedInt32Type, UnsignedInt64Type,
} from "../../type/primitive_type";
import {WConst} from "../../wasm";
import {WExpression} from "../../wasm/node";
import {WDrop, WExprStatement} from "../../wasm/statement";
import {CompileContext} from "../context";
import {FunctionLookUpResult} from "../scope";

export interface ExpressionResult {
    type: Type;
    expr: WExpression;
    isLeft: boolean;
}

export abstract class Expression extends Node {

    constructor(location: SourceLocation) {
        super(location);
    }

    public abstract codegen(ctx: CompileContext): ExpressionResult;

    public abstract deduceType(ctx: CompileContext): Type;

    public evaluate(ctx: CompileContext): string {
        const expr = this.codegen(ctx);
        if (!(expr.type instanceof ArithmeticType)) {
            throw new SyntaxError(`illegal template parameter`, this);
        }
        const wexpr = expr.expr.fold();
        if (!(wexpr instanceof WConst)) {
            throw new SyntaxError(`template parameter must be static value`, this);
        }
        return wexpr.constant;
    }
}

export function recycleExpressionResult(ctx: CompileContext, node: Node, expr: ExpressionResult) {
    if (expr.isLeft && expr.expr.isPure()) {
        return;
    }
    if (expr.type.equals(PrimitiveTypes.void)) {
        ctx.submitStatement(new WExprStatement(expr.expr.fold(), node.location));
    } else {
        ctx.submitStatement(new WDrop(expr.expr.fold(), node.location));
    }
}

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
