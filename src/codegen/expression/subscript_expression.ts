import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {BinaryExpression} from "./binary_expression";
import {Expression, ExpressionResult} from "./expression";
import {UnaryExpression} from "./unary_expression";

export class SubscriptExpression extends Expression {
    public array: Expression;
    public subscript: Expression;
    public unaryExpr: UnaryExpression;

    constructor(location: SourceLocation, array: Expression, subscript: Expression) {
        super(location);
        this.array = array;
        this.subscript = subscript;
        this.unaryExpr = new UnaryExpression(
            this.location,
            "*",
            new BinaryExpression(
                this.location,
                "+",
                this.array,
                this.subscript,
            ),
        );
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        return this.unaryExpr.codegen(ctx);
    }

    public deduceType(ctx: CompileContext): Type {
        return this.unaryExpr.deduceType(ctx);
    }

}
