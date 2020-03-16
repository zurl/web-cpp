import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {CompileContext} from "../context";
import {Expression, recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {UnaryExpression} from "../expression/unary_expression";
import {CallExpression} from "../function/call_expression";

export class ObjectInitializer extends Node {
    public argus: Expression[];

    constructor(location: SourceLocation, argus: Expression[]) {
        super(location);
        this.argus = argus;
    }

    public initialize(ctx: CompileContext, name: Identifier, type: Type) {
        if ( !(type instanceof ClassType)) {
            throw new SyntaxError(`only class type could apply object initializer`, this);
        }
        const ctorName = type.fullName + "::#" + type.shortName;
        const callee = Identifier.fromString(this.location, ctorName);
        const thisPtr = new UnaryExpression(this.location, "&",
            Identifier.fromString(this.location, name.getPlainName(ctx)));
        const expr = new CallExpression(this.location, callee, [thisPtr, ...this.argus]);
        recycleExpressionResult(ctx, expr.codegen(ctx));
    }
}
