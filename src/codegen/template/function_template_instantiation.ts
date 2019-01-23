import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, Node, SourceLocation} from "../../common/node";
import {AddressType, FunctionEntity, Variable} from "../../common/symbol";
import {FunctionTemplate} from "../../common/template";
import {AccessControl, Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {FunctionType, UnresolvedFunctionOverloadType} from "../../type/function_type";
import {CompileContext} from "../context";
import {Declarator} from "../declaration/declarator";
import {SpecifierList} from "../declaration/specifier_list";
import {defineFunction, FunctionConfig} from "../function/function";
import {EvaluatedTemplateArgument} from "./template_argument";
import {deduceFunctionTemplateParameters, deduceFunctionTypeOfTemplate} from "./template_deduce";

export class FunctionTemplateInstantiation extends ClassDirective {
    public specifiers: SpecifierList;
    public declarator: Declarator;

    constructor(location: SourceLocation, specifiers: SpecifierList, declarator: Declarator) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        throw new InternalError(`todo`);
    }

    public codegen(ctx: CompileContext): void {
        const name = this.declarator.getNameRequired();
        const lookupType = name.deduceType(ctx);
        const functionType = this.declarator.getType(ctx, this.specifiers.getType(ctx));
        if (!(lookupType instanceof UnresolvedFunctionOverloadType) || !(functionType instanceof FunctionType)) {
            throw new SyntaxError(`${name.getLookupName(ctx)} is not a function template`, this);
        }
        const lookupResult = lookupType.functionLookupResult;
        for (const item of lookupResult.functions) {
            if (item instanceof FunctionTemplate) {
                const params = deduceFunctionTemplateParameters(item, functionType,
                    lookupResult.templateArguments, false);
                if (params !== null) {
                    // match_successful point;
                    instantiateFunctionTemplate(ctx, item, params, this);
                    return;
                }
            }
        }
        throw new SyntaxError(`no matched function template`, this);
    }

}

export function instantiateFunctionTemplate(ctx: CompileContext,
                                            funcTemplate: FunctionTemplate,
                                            args: EvaluatedTemplateArgument[],
                                            node: Node) {
    const type = deduceFunctionTypeOfTemplate(funcTemplate.functionConfig.functionType, args) as FunctionType;
    const signature = args.map((x) => x.toString()).join(",");
    const instanceName = funcTemplate.shortName + "@" + signature;
    const longInstanceName = instanceName + "@" + type.toMangledName();
    ctx.scopeManager.enterSavedScope(funcTemplate.scopeContext);
    funcTemplate.instanceMap.set(signature, new FunctionEntity(
        longInstanceName + "@" + type.toMangledName(),
        ctx.scopeManager.getFullName(longInstanceName),
        ctx.fileName, type,
        funcTemplate.functionConfig.parameterInits, false, true,
        AccessControl.Public,
    ));
    ctx.scopeManager.enterUnnamedScope(true);
    for (let i = 0; i < args.length; i++) {
        const name = funcTemplate.templateParams[i].name;
        const arg = args[i];
        if (arg instanceof Type) {
            ctx.scopeManager.define(name, arg, node);
        } else {
            ctx.scopeManager.define(name, new Variable(
                name, ctx.scopeManager.getFullName(name), ctx.fileName,
                funcTemplate.templateParams[i].type, AddressType.CONSTANT, arg,
                AccessControl.Public,
            ), node);
        }
    }
    let funcBody = funcTemplate.functionBody.body.body;
    const spec = funcTemplate.specializationMap.get(signature);
    if (spec) {
        funcBody = spec.body.body;
    }
    const functionConfig: FunctionConfig = {
        name: instanceName,
        functionType: type,
        parameterNames: funcTemplate.functionConfig.parameterNames,
        parameterInits: funcTemplate.functionConfig.parameterInits,
        isLibCall: funcTemplate.functionConfig.isLibCall,
        accessControl: funcTemplate.functionConfig.accessControl,
        activeScopes: [ctx.scopeManager.currentContext.scope],
    };
    defineFunction(ctx, functionConfig, funcBody, node);
    ctx.scopeManager.currentContext.scope.children.map((scope) =>
        ctx.scopeManager.currentContext.scope.parent.children.push(scope));
    ctx.scopeManager.detachCurrentScope();
    ctx.scopeManager.exitScope();
    ctx.scopeManager.exitScope();
}
