import {LanguageError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {CompileContext} from "../context";
import {Expression, ExpressionResult, recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {UnaryExpression} from "../expression/unary_expression";
import {CallExpression} from "../function/call_expression";

export class ConstructorCallExpression extends Expression {
    public name: Identifier;
    public arguments: Expression[];

    constructor(location: SourceLocation, name: Identifier, myArguments: Expression[]) {
        super(location);
        this.name = name;
        this.arguments = myArguments;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        if ( !ctx.isCpp() ) {
            throw new LanguageError(`constructor is noly support in c++`, this);
        }
        const classType = this.deduceType(ctx);
        if (!(classType instanceof ClassType)) {
            throw new SyntaxError(`constructor call must be class type`, this);
        }
        const ctorName = classType.fullName + "::#" + classType.shortName;
        const callee = Identifier.fromString(this.location, ctorName);
        const [tmpVarName] = ctx.allocTmpVar(classType, this);
        const thisVar = Identifier.fromString(this.location, tmpVarName);
        const thisPtr = new UnaryExpression(this.location, "&", thisVar);
        recycleExpressionResult(ctx, this,
            new CallExpression(this.location, callee, [thisPtr, ...this.arguments]).codegen(ctx));
        return thisVar.codegen(ctx);
    }

    public deduceType(ctx: CompileContext): Type {
        return this.name.deduceType(ctx);

    }

}
