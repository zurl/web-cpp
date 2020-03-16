import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {LeftReferenceType} from "../../type/compound_type";
import {ArithmeticType, PrimitiveTypes} from "../../type/primitive_type";
import {WConditionalExpression} from "../../wasm";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {TypeConverter} from "../type_converter";
import {arithmeticDeduce} from "./binary_expression";
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
        const test = new TypeConverter(this.test.codegen(ctx)).tryConvertTo(ctx, PrimitiveTypes.int32);
        const targetType = this.deduceType(ctx);

        const left = this.consequent.codegen(ctx);
        const right = this.alternate.codegen(ctx);
        if (targetType instanceof ClassType) {
            const refType = new LeftReferenceType(targetType);
            return {
                type: refType,
                expr: new WAddressHolder(new WConditionalExpression(
                    test.expr,
                    new TypeConverter(left).tryConvertTo(ctx, refType, false).expr,
                    new TypeConverter(right).tryConvertTo(ctx, refType, false).expr,
                    this.location,
                ), AddressType.RVALUE, this.location),
            };
        } else {
            return {
                type: targetType,
                expr: new WConditionalExpression(
                    test.expr,
                    new TypeConverter(left).tryConvertTo(ctx, targetType).expr,
                    new TypeConverter(right).tryConvertTo(ctx, targetType).expr,
                    this.location,
                ),
            };
        }
    }

    public deduceType(ctx: CompileContext): Type {
        const leftType = TypeConverter.fromType(this.consequent.deduceType(ctx)).toRValue(ctx).type;
        const rightType = TypeConverter.fromType(this.alternate.deduceType(ctx)).toRValue(ctx).type;
        if (leftType instanceof ArithmeticType && rightType instanceof ArithmeticType) {
            return arithmeticDeduce(leftType, rightType);
        } else if (leftType.equals(rightType)) {
            return leftType;
        } else {
            throw new SyntaxError(`the type between conditional expression is not same`, this);
        }
    }

}
