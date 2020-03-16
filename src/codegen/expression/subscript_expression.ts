import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {MemberExpression} from "../class/member_expression";
import {CompileContext} from "../context";
import {CallExpression} from "../function/call_expression";
import {BinaryExpression} from "./binary_expression";
import {Expression, ExpressionResult} from "./expression";
import {Identifier} from "./identifier";
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
        const leftType = this.array.deduceType(ctx);

        if (leftType instanceof ClassType) {
            const item = ctx.scopeManager.lookup(
                leftType.fullName + "::#[]",
            );
            if (item != null) {
                return new CallExpression(this.location,
                    new MemberExpression(this.location, this.array, false,
                        Identifier.fromString(this.location, "#[]")),
                    [this.subscript]).codegen(ctx);
            }
        }

        return this.unaryExpr.codegen(ctx);
    }

    public deduceType(ctx: CompileContext): Type {
        const leftType = this.array.deduceType(ctx);

        if (leftType instanceof ClassType) {
            const item = ctx.scopeManager.lookup(
                leftType.fullName + "::#[]",
            );
            if (item != null) {
                return new CallExpression(this.location,
                    new MemberExpression(this.location, this.array, false,
                        Identifier.fromString(this.location, "#[]")),
                    [this.subscript]).deduceType(ctx);
            }
        }

        return this.unaryExpr.deduceType(ctx);
    }

}
