import {InternalError} from "../../common/error";
import {Node} from "../../common/node";
import {Variable} from "../../common/symbol";
import {ClassType} from "../../type/class_type";
import {CompileContext} from "../context";
import {recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {CallExpression} from "../function/call_expression";
import {MemberExpression} from "./member_expression";

export function triggerDestructor(ctx: CompileContext, obj: Variable, node: Node) {
    const classType = obj.type;
    if (!(classType instanceof ClassType)) {
        throw new InternalError(`triggerDestructor()`);
    }
    const fullName = classType.fullName + "::~" + classType.shortName;
    const dtor = ctx.scopeManager.lookup(fullName);
    if (dtor === null) {
        return;
    }
    recycleExpressionResult(ctx, node,
        new CallExpression(node.location,
            new MemberExpression(node.location, Identifier.fromString(node.location, obj.shortName),
                false, Identifier.fromString(node.location, "~" + classType.shortName)), [],
        ).codegen(ctx));

}

export function triggerAllDestructor(ctx: CompileContext, node: Node) {
    for (const item of ctx.scopeManager.currentContext.scope.map.values()) {
        const x = item[0];
        if (x instanceof Variable && x.type instanceof ClassType) {
            triggerDestructor(ctx, x, node);
        }
    }
}
