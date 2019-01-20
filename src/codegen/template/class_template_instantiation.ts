import {Node} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ClassTemplate} from "../../type/template_type";
import {CompileContext} from "../context";
import {EvaluatedTemplateArgument} from "./template_argument";

export function instantiateClassTemplate(ctx: CompileContext,
                                         classTemplate: ClassTemplate,
                                         args: EvaluatedTemplateArgument[],
                                         node: Node): ClassType {
    const signature = args.map((x) => x.toString()).join(",");

    ctx.scopeManager.enterSavedScope(classTemplate.scopeContext);
    ctx.scopeManager.enterUnnamedScope(true);
    for (let i = 0; i < args.length; i++) {
        const name = classTemplate.templateParams[i].name;
        const arg = args[i];
        if (arg instanceof Type) {
            ctx.scopeManager.define(name, arg, node);
        } else {
            ctx.scopeManager.define(name, new Variable(
                name, ctx.scopeManager.getFullName(name), ctx.fileName,
                classTemplate.templateParams[i].type, AddressType.CONSTANT, arg,
            ), node);
        }
    }
    let body = classTemplate.classBody;
    const spec = classTemplate.specializationMap.get(signature);
    if (spec) {
        body = spec;
    }

    // === hack name ===
    const oldName = body.identifier.name[body.identifier.name.length - 1].name;
    body.identifier.name[body.identifier.name.length - 1].name += "<" + signature + ">";
    const instanceName = body.identifier.getShortName(ctx);
    const classType = body.codegen(ctx);
    body.identifier.name[body.identifier.name.length - 1].name = oldName;

    ctx.scopeManager.currentContext.scope.children.map((scope) =>
        ctx.scopeManager.currentContext.scope.parent.children.push(scope));
    ctx.scopeManager.detachCurrentScope();
    ctx.scopeManager.exitScope();
    ctx.scopeManager.define(instanceName, classType, node);
    ctx.scopeManager.exitScope();
    return classType;
}
