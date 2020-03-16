import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, Node, SourceLocation} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {ClassTemplate, FunctionTemplate} from "../../common/template";
import {AccessControl, Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ClassSpecifier} from "../class/class_specifier";
import {CompileContext} from "../context";
import {EvaluatedTemplateArgument} from "./template_argument";

export class ClassTemplateInstantiation extends ClassDirective {
    public specifier: ClassSpecifier;

    constructor(location: SourceLocation, specifier: ClassSpecifier) {
        super(location);
        this.specifier = specifier;
    }

    public codegen(ctx: CompileContext): void {
        const name = this.specifier.identifier;
        const lookupName = name.getLookupName(ctx);
        const classTemplate = ctx.scopeManager.lookup(lookupName);
        if (!(classTemplate instanceof ClassTemplate)) {
            throw new SyntaxError(`${lookupName} is not a class template`, this);
        }
        const args = name.fillInBlank(ctx, name.getLastID().args, classTemplate);
        const signature = "<" + args.map((x) => x.toString).join(",") + ">";
        const classInstance = ctx.scopeManager.lookup(classTemplate.fullName + signature);
        if (!classInstance) {
            instantiateClassTemplate(ctx, classTemplate, args, this);
        }
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        throw new InternalError(`todo`);
    }

}

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
                AccessControl.Public,
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
