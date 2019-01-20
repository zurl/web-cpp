import {SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Expression, recycleExpressionResult} from "../expression/expression";
import {Statement} from "./statement";

export class ExpressionStatement extends Statement {
    public expression: Expression;

    constructor(location: SourceLocation, expression: Expression) {
        super(location);
        this.expression = expression;
    }

    public codegen(ctx: CompileContext) {
        recycleExpressionResult(ctx, this, this.expression.codegen(ctx));
    }
}
