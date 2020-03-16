import * as Long from "long";
import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {
    ArithmeticType, CharType, DoubleType,
    FloatType, Int16Type,
    Int32Type,
    Int64Type,
    PrimitiveTypes, UnsignedCharType, UnsignedInt16Type,
    UnsignedInt32Type,
    UnsignedInt64Type,
} from "../../type/primitive_type";
import {WConst, WDrop, WExpression, WExprStatement} from "../../wasm";
import {CompileContext} from "../context";

export interface ExpressionResult {
    type: Type;
    expr: WExpression;
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

export function recycleExpressionResult(ctx: CompileContext, expr: ExpressionResult) {
    if (expr.expr.isPure()) {
        return;
    }
    if (expr.type.equals(PrimitiveTypes.void)) {
        ctx.submitStatement(new WExprStatement(expr.expr.fold(), expr.expr.location));
    } else {
        ctx.submitStatement(new WDrop(expr.expr.fold(), expr.expr.location));
    }
}
