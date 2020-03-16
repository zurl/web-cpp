import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {TypeName} from "../class/type_name";
import {CompileContext} from "../context";
import {TypeConverter} from "../type_converter";
import {Expression, ExpressionResult} from "./expression";

export class CastExpression extends Expression {
    public typeName: TypeName;
    public operand: Expression;

    constructor(location: SourceLocation, typeName: TypeName, operand: Expression) {
        super(location);
        this.typeName = typeName;
        this.operand = operand;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        return new TypeConverter(this.operand.codegen(ctx))
            .tryConvertTo(ctx, this.deduceType(ctx), false, true);
    }

    public deduceType(ctx: CompileContext): Type {
        return this.typeName.deduceType(ctx);
    }

}
