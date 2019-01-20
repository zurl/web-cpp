import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {AssignmentExpression} from "./assignment_expression";
import {BinaryExpression} from "./binary_expression";
import {Expression, ExpressionResult, recycleExpressionResult} from "./expression";
import {IntegerConstant} from "./integer_constant";

export class PostfixExpression extends Expression {
    public operand: Expression;
    public decrement: boolean;

    constructor(location: SourceLocation, operand: Expression, decrement: boolean) {
        super(location);
        this.operand = operand;
        this.decrement = decrement;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const ope = this.operand.codegen(ctx);
        if (!ope.isLeft || !(ope.expr instanceof WAddressHolder)) {
            throw new SyntaxError(`your could not ++ a left value`, this);
        }
        recycleExpressionResult(ctx, this, new AssignmentExpression(this.location,
            "=", this.operand, new BinaryExpression(
                this.location, this.decrement ? "-" : "+", this.operand, IntegerConstant.OneConstant,
            )).codegen(ctx));
        return ope;
    }

    public deduceType(ctx: CompileContext): Type {
        return this.operand.deduceType(ctx);

    }

}
