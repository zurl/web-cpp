/*
the overview design of template

1. define of template function
2. call of template function
3. instance a template function
3. define of template class
4. instance of templae class

subproblems
1. pattern matching
    1.non-template yousen
 */

import {
    AbstractArrayDeclarator,
    ClassSpecifier,
    Declarator, FunctionDefinition,
    FunctionTemplateInstantiation,
    Node,
    ParameterDeclaration, SpecifierType,
    TemplateArgument,
    TemplateDeclaration,
    TemplateParameterType,
    TypeName,
    TypeParameter,
} from "../../common/ast";
import {InternalError, SyntaxError} from "../../common/error";
import {AddressType, FunctionEntity, Variable} from "../../common/symbol";
import {AccessControl, Type} from "../../type";
import {ArrayType, LeftReferenceType, PointerType, ReferenceType, RightReferenceType} from "../../type/compound_type";
import {FunctionType} from "../../type/function_type";
import {
    EvaluatedTemplateArgument,
    FunctionTemplate,
    TemplateParameter,
    TemplateParameterPlaceHolderType,
    TemplateType,
} from "../../type/template_type";
import {CompileContext} from "../context";
import {
    getDeclaratorIdentifierArguments,
    getDeclaratorIdentifierName,
    parseAbstractDeclarator,
    parseDeclarator,
    parseDeclaratorOrAbstractDeclarator,
    parseTypeFromSpecifiers,
} from "../declaration";
import {defineFunction, evaluateConstantExpression, parseFunctionDeclarator} from "../function";
import {FunctionLookUpResult} from "../scope";

/*
# consturtor/destruc
@ mangeld
$ scope2
:: scope
, type spliter
 */

function parseFunctionTemplateParameters(ctx: CompileContext,
                                         param: TemplateParameterType, node: Node): TemplateParameter {
    if (param instanceof ParameterDeclaration) {
        const baseType = parseTypeFromSpecifiers(ctx, param.specifiers, node);
        if (baseType == null) {
            throw new SyntaxError(`illegal return type`, node);
        }
        let resultType = baseType;
        let name = "";
        if (param.declarator instanceof Declarator) {
            const [varType, varName] = parseDeclarator(ctx, param.declarator, baseType);
            resultType = varType;
            name = varName;
        } else if (param.declarator instanceof AbstractArrayDeclarator) {
            resultType = parseAbstractDeclarator(ctx, param.declarator, baseType);
        }
        return {
            name,
            type: resultType,
            init: param.init ? evaluateConstantExpression(ctx, param.init, node) : null,
        };
    } else {
        return {
            name: param.name.name,
            type: TemplateType.instance,
            init: param.init ? param.init.deduceType(ctx) : null,
        };
    }
}

TemplateDeclaration.prototype.codegen = function(ctx: CompileContext) {
    if (this.args.length === 0) {
        // Specialization
        if (this.decl instanceof ClassSpecifier) {
            // class template
            throw {};
        } else {
            createFunctionTemplateSpecialization(ctx, this.decl);
        }
        return;
    }
    const contextScope = ctx.scopeManager.currentScope;
    ctx.scopeManager.enterUnnamedScope();
    for (let i = 0; i < this.args.length; i++) {
        const arg = this.args[i];
        if (arg instanceof ParameterDeclaration) {
            const [argType, argName] =
                parseDeclaratorOrAbstractDeclarator(
                    ctx, arg.declarator,
                    parseTypeFromSpecifiers(ctx, arg.specifiers, this),
                );
            if (argName !== null) {
                ctx.scopeManager.define(argName, argType, this);
            }
        } else {
            ctx.scopeManager.define(arg.name.name,
                new TemplateParameterPlaceHolderType(i), this);
        }
    }
    if (this.decl instanceof ClassSpecifier) {
        // class template
        throw {};
    } else {
        const resultType = parseTypeFromSpecifiers(ctx, this.decl.specifiers, this);
        if (resultType == null) {
            throw new SyntaxError(`illegal return type`, this);
        }
        const functionType = parseFunctionDeclarator(ctx, this.decl.declarator, resultType);
        if (functionType == null) {
            throw new SyntaxError(`illegal function definition`, this);
        }
        const realName = functionType.name + "@" + functionType.toMangledName();
        const fullName = ctx.scopeManager.getFullName(realName);
        const functionTemplate = new FunctionTemplate(
            realName,
            fullName,
            ctx.fileName,
            functionType,
            this.args.map((x) => parseFunctionTemplateParameters(ctx, x, this)),
            this.decl,
            contextScope,
        );
        ctx.scopeManager.exitScope();
        ctx.scopeManager.define(realName, functionTemplate, this);
    }
};

function lookupMatchedFunctionTemplate(ctx: CompileContext,
                                       specifiers: SpecifierType[],
                                       declarator: Declarator,
                                       node: Node)
    : [FunctionLookUpResult, FunctionType, EvaluatedTemplateArgument[]] {
    const name = getDeclaratorIdentifierName(declarator);
    const lookupResult = ctx.scopeManager.lookupAnyName(name);
    if (!lookupResult) {
        throw new SyntaxError(`cannot find template ${name}`, node);
    }
    if (!(lookupResult instanceof FunctionLookUpResult)) {
        throw new SyntaxError(`${name} is not template`, node);
    }
    const args = getDeclaratorIdentifierArguments(declarator)
        .map((x) => evaluateTemplateArgument(ctx, x, node));
    const resultType = parseTypeFromSpecifiers(ctx, specifiers, node);
    if (resultType == null) {
        throw new SyntaxError(`illegal return type`, node);
    }
    const functionType = parseFunctionDeclarator(ctx, declarator, resultType);
    if (functionType == null) {
        throw new SyntaxError(`illegal function definition`, node);
    }
    return [lookupResult, functionType, args];
}

FunctionTemplateInstantiation.prototype.codegen = function(ctx: CompileContext) {
    const [lookupResult, functionType, args] = lookupMatchedFunctionTemplate(ctx,
        this.specifiers, this.declarator, this);
    for (const item of lookupResult.functions) {
        if (item instanceof FunctionTemplate) {
            const params = deduceFunctionTemplateParameters(item, functionType, args, false);
            if (params !== null) {
                // match_successful point;
                createDeferInstantiationTask(ctx, item, params);
                return;
            }
        }
    }
    throw new SyntaxError(`no matched function template`, this);
};

function deduceFunctionTypeOfTemplate(type: Type,
                                      params: EvaluatedTemplateArgument[]): Type {
    if (type instanceof FunctionType) {
        return new FunctionType(type.name, deduceFunctionTypeOfTemplate(type.returnType, params),
        type.parameterTypes.map((x) => deduceFunctionTypeOfTemplate(x, params)),
        type.parameterNames, type.variableArguments);
    } else if (type instanceof PointerType) {
        return new PointerType(deduceFunctionTypeOfTemplate(type.elementType, params));
    } else if (type instanceof RightReferenceType) {
        return new RightReferenceType(deduceFunctionTypeOfTemplate(type.elementType, params));
    } else if (type instanceof LeftReferenceType) {
        return new LeftReferenceType(deduceFunctionTypeOfTemplate(type.elementType, params));
    } else if (type instanceof ArrayType) {
        return new ArrayType(deduceFunctionTypeOfTemplate(type.elementType, params), type.size);
    } else if (type instanceof TemplateParameterPlaceHolderType) {
        const arg = params[type.index];
        if (arg === null) {
            throw new InternalError(`deduceFunctionTypeOfTemplate()`);
        } else if (arg instanceof Type) {
            return arg;
        } else {
            throw new InternalError(`deduceFunctionTypeOfTemplate()`);
        }
    } else {
        return type;
    }
}

export function createDeferInstantiationTask(ctx: CompileContext,
                                             funcTemplate: FunctionTemplate,
                                             params: EvaluatedTemplateArgument[]) {
    const type = deduceFunctionTypeOfTemplate(funcTemplate.type, params) as FunctionType;
    const signature = params.map((x) => x.toString()).join(",");
    const instanceName = funcTemplate.name + "@" + signature + "@" + type.toMangledName();
    funcTemplate.instanceMap.set(signature, new FunctionEntity(
        instanceName,
        funcTemplate.contextScope.getFullName(instanceName),
        ctx.fileName,
        type, false, true,
        AccessControl.Public,
    ));
    ctx.submitDeferInstantiationTask({funcTemplate, type, args: params});
}

export function executeDeferFunctionTemplateInstantiation(ctx: CompileContext) {
    ctx.deferInstantiationTasks.map((task) => {
        instantiateFunctionTemplate(ctx, task.funcTemplate, task.type, task.args);
    });
    ctx.deferInstantiationTasks = [];
}

function instantiateFunctionTemplate(ctx: CompileContext,
                                     funcTemplate: FunctionTemplate,
                                     type: FunctionType,
                                     args: EvaluatedTemplateArgument[]) {
    const signature = args.map((x) => x.toString()).join(",");
    const instanceName = funcTemplate.name + "@" + signature;

    ctx.scopeManager.enterTempScope(funcTemplate.contextScope);
    ctx.scopeManager.enterUnnamedScope();
    // hack
    ctx.scopeManager.currentScope.fullName = ctx.scopeManager.currentScope.parent.fullName;
    for (let i = 0; i < args.length; i++) {
        const name = funcTemplate.templateParams[i].name;
        const arg = args[i];
        if (arg instanceof Type) {
            ctx.scopeManager.define(name, arg);
        } else {
            ctx.scopeManager.define(name, new Variable(
                name, ctx.scopeManager.getFullName(name), ctx.fileName,
                funcTemplate.templateParams[i].type, AddressType.CONSTANT, arg,
            ));
        }
    }
    type.name = instanceName;
    let funcBody = funcTemplate.functionBody.body.body;
    const spec = funcTemplate.specializationMap.get(signature);
    if (spec) {
        funcBody = spec.body.body;
    }
    defineFunction(ctx, type, funcBody,
        AccessControl.Public, funcTemplate.functionBody);
    ctx.scopeManager.exitScope();
    ctx.scopeManager.exitTempScope();
}

export function evaluateTemplateArgument(ctx: CompileContext, arg: TemplateArgument,
                                         node: Node): EvaluatedTemplateArgument {
    if (arg instanceof TypeName) {
        return arg.deduceType(ctx);
    } else {
        return evaluateConstantExpression(ctx, arg, node);
    }
}

export function deduceFunctionTemplateParameters(functionTemplate: FunctionTemplate,
                                                 functionType: FunctionType,
                                                 args: EvaluatedTemplateArgument[],
                                                 weakMatch: boolean)
    : EvaluatedTemplateArgument[] | null {
    if (args.length > functionTemplate.templateParams.length) {
        return null;
    }
    const params = functionType.parameterTypes.filter(() => true);
    if (functionTemplate.type.parameterTypes.length !== params.length) {
        if (!weakMatch) {
            return null;
        } else {
            if (params.length > functionTemplate.type.parameterTypes.length) {
                return null;
            }
            for (let i = params.length; i < functionTemplate.type.parameterTypes.length; i++) {
                if (functionTemplate.type.parameterInits[i] !== null) {
                    params.push(functionTemplate.type.parameterTypes[i]);
                }
            }
        }
    }
    // 1.build default table
    const templateParametersTable: Array<EvaluatedTemplateArgument|null> = [];
    for (let i = 0; i < functionTemplate.templateParams.length; i++) {
        templateParametersTable.push(null);
    }
    for (let i = 0; i < args.length; i++) {
        templateParametersTable[i] = args[i];
    }
    try {
        for (let i = 0; i < params.length; i++) {
            tryMatchTemplateType(templateParametersTable,
                functionTemplate.type.parameterTypes[i],
                params[i],
                weakMatch);
        }
    } catch (e) {
        return null;
    }
    for (let i = 0; i < functionTemplate.templateParams.length; i++) {
        if (templateParametersTable[i] === null) {
            if (functionTemplate.templateParams[i].init !== null) {
                templateParametersTable[i] = functionTemplate.templateParams[i].init;
            } else {
                return null;
            }
        }
    }
    return templateParametersTable as EvaluatedTemplateArgument[];
}

export function tryMatchTemplateType(table: Array<EvaluatedTemplateArgument|null>,
                                     templateType: Type,
                                     instanceType: Type,
                                     weakMatch: boolean) {
    if (templateType instanceof FunctionType) {
        if (!(instanceType instanceof FunctionType)) {
            throw {};
        }
        if (instanceType.parameterTypes.length !== templateType.parameterTypes.length) {
            throw {};
        }
        tryMatchTemplateType(table, templateType.returnType, instanceType.returnType, weakMatch);
        for (let i = 0; i < templateType.parameterTypes.length; i++) {
            tryMatchTemplateType(table, templateType.parameterTypes[i], instanceType.parameterTypes[i], weakMatch);
        }
    } else if (templateType instanceof PointerType) {
        if (instanceType instanceof PointerType) {
            tryMatchTemplateType(table, templateType.elementType, instanceType.elementType, weakMatch);
        } else {
            throw {};
        }
    } else if (templateType instanceof ReferenceType) {
        if (instanceType instanceof ReferenceType) {
            tryMatchTemplateType(table, templateType.elementType, instanceType.elementType, weakMatch);
        } else {
            throw {};
        }
    } else if (templateType instanceof ArrayType) {
        if (instanceType instanceof ArrayType) {
            tryMatchTemplateType(table, templateType.elementType, instanceType.elementType, weakMatch);
        } else {
            throw {};
        }
    } else if (templateType instanceof TemplateParameterPlaceHolderType) {
        const arg = table[templateType.index];
        if (arg === null) {
            table[templateType.index] = instanceType;
        } else if (arg instanceof Type) {
            if (instanceType instanceof TemplateParameterPlaceHolderType) {
                if (templateType.index !== instanceType.index) {
                    throw {};
                }
            } else {
                if (weakMatch) {
                    if (!arg.compatWith(instanceType)) {
                        throw {};
                    }
                } else {
                    if (!arg.equals(instanceType)) {
                        throw {};
                    }
                }
            }
        } else {
            throw {};
        }
    } else {
        if (weakMatch) {
            if (!templateType.compatWith(instanceType)) {
                throw {};
            }
        } else {
            if (!templateType.equals(instanceType)) {
                throw {};
            }
        }
    }
}

function createFunctionTemplateSpecialization(ctx: CompileContext,
                                              func: FunctionDefinition) {
    // lookup
    const [lookupResult, functionType, args] = lookupMatchedFunctionTemplate(ctx,
        func.specifiers, func.declarator, func);
    for (const item of lookupResult.functions) {
        if (item instanceof FunctionTemplate) {
            const params = deduceFunctionTemplateParameters(item, functionType, args, false);
            if (params !== null) {
                // match_successful point;
                const signature = args.map((x) => x.toString()).join(",");
                if (item.specializationMap.has(signature)) {
                    throw new SyntaxError("duplication Specialization", func);
                }
                item.specializationMap.set(signature, func);
                return;
            }
        }
    }
    throw new SyntaxError(`no matched function template`, func);
}

export function template() {
    return "template";
}
