import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {Expression, ExpressionResult} from "./expression";

export class AnonymousExpression extends Expression {
    public expr: ExpressionResult;

    constructor(location: SourceLocation, expr: ExpressionResult) {
        super(location);
        this.expr = expr;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        return this.expr;
    }

    public deduceType(ctx: CompileContext): Type {
        return this.expr.type;
    }
}

export class AnonymousCastExpression extends Expression {
    public expr: Expression;
    public type: Type;

    constructor(location: SourceLocation, expr: Expression, type: Type) {
        super(location);
        this.expr = expr;
        this.type = type;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const result = this.expr.codegen(ctx);
        result.type = this.type;
        return result;
    }

    public deduceType(ctx: CompileContext): Type {
        return this.type;
    }

}
