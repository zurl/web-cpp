import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {LeftReferenceType} from "../../type/compound_type";
import {ArithmeticType, PrimitiveTypes} from "../../type/primitive_type";
import {WConditionalExpression} from "../../wasm/expression";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {arithmeticDeduce, doConversion, doTypeTransfrom} from "../conversion";
import {Expression, ExpressionResult} from "./expression";

export class ConditionalExpression extends Expression {
    public test: Expression;
    public consequent: Expression;
    public alternate: Expression;

    constructor(location: SourceLocation, test: Expression, consequent: Expression, alternate: Expression) {
        super(location);
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
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
    }

    public deduceType(ctx: CompileContext): Type {
        const leftType = doTypeTransfrom(this.consequent.deduceType(ctx));
        const rightType = doTypeTransfrom(this.alternate.deduceType(ctx));
        if (leftType instanceof ArithmeticType && rightType instanceof ArithmeticType) {
            return arithmeticDeduce(leftType, rightType);
        } else if (leftType.equals(rightType)) {
            return leftType;
        } else {
            throw new SyntaxError(`the type between conditional expression is not same`, this);
        }
    }

}
