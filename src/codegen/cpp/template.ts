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
    TemplateArgument, TemplateClassInstanceIdentifier,
    TemplateDeclaration,
    TemplateParameterType,
    TypeName,
    TypeParameter,
} from "../../common/ast";
import {InternalError, SyntaxError} from "../../common/error";
import {AddressType, FunctionEntity, Variable} from "../../common/symbol";
import {AccessControl, Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType, LeftReferenceType, PointerType, ReferenceType, RightReferenceType} from "../../type/compound_type";
import {FunctionType, UnresolvedFunctionOverloadType} from "../../type/function_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {
    ClassTemplate,
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
            throw new InternalError(`ClassSpecifier LENGTH=0`);
        } else {
            createFunctionTemplateSpecialization(ctx, this.decl);
        }
        return;
    }
    const contextScope = ctx.scopeManager.currentScope;
    const contextActiveScopes = ctx.scopeManager.activeScopes;
    ctx.scopeManager.enterUnnamedScope(true);
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
        const realName = this.decl.identifier.name;
        const fullName = ctx.scopeManager.getFullName(realName);
        const classTemplate = new ClassTemplate(
            realName, fullName, ctx.fileName,
            this.args.map((x) => parseFunctionTemplateParameters(ctx, x, this)),
            this.decl,
            contextScope,
            contextActiveScopes,
        );
        ctx.scopeManager.detachCurrentScope();
        ctx.scopeManager.exitScope();
        ctx.scopeManager.define(realName, classTemplate, this);
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
            contextActiveScopes,
        );
        ctx.scopeManager.detachCurrentScope();
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
                instantiateFunctionTemplate(ctx, item, params);
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

export function instantiateFunctionTemplate(ctx: CompileContext,
                                            funcTemplate: FunctionTemplate,
                                            args: EvaluatedTemplateArgument[]) {
    const type = deduceFunctionTypeOfTemplate(funcTemplate.type, args) as FunctionType;
    const signature = args.map((x) => x.toString()).join(",");
    const instanceName = funcTemplate.name + "@" + signature;
    const longInstanceName = instanceName +  "@" + type.toMangledName();
    funcTemplate.instanceMap.set(signature, new FunctionEntity(
        longInstanceName + "@" + type.toMangledName(),
        funcTemplate.contextScope.getFullName(longInstanceName),
        ctx.fileName,
        type, false, true,
        AccessControl.Public,
    ));
    ctx.scopeManager.enterTempScope(funcTemplate.contextScope, funcTemplate.contextActiveScopes);
    ctx.scopeManager.enterUnnamedScope(true);
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
    ctx.scopeManager.currentScope.children.map((scope) =>
        ctx.scopeManager.currentScope.parent.children.push(scope));
    ctx.scopeManager.detachCurrentScope();
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

TemplateClassInstanceIdentifier.prototype.codegen = function(ctx: CompileContext): Type {
    const name = this.name.name;
    const lookupResult = ctx.scopeManager.lookupAnyName(name);
    if (!lookupResult) {
        throw new SyntaxError(`cannot find template ${name}`, this);
    }
    if (!(lookupResult instanceof ClassTemplate)) {
        throw new SyntaxError(`${name} is not template`, this);
    }
    const templateArguments = this.args.map((arg) => evaluateTemplateArgument(ctx, arg, this));
    while (templateArguments.length < lookupResult.templateParams.length) {
        const init = lookupResult.templateParams[templateArguments.length].init;
        if (init !== null) {
            templateArguments.push(init);
        } else {
            throw new SyntaxError(`template number mismatch of template ${lookupResult.name}`, this);
        }
    }
    const signature = templateArguments.map((x) => x.toString()).join(",");
    const classType = lookupResult.instanceMap.get(signature);
    if (classType) {
        return classType;
    }
    return instantiateClassTemplate(ctx, lookupResult, templateArguments, this);
};

function instantiateClassTemplate(ctx: CompileContext,
                                  classTemplate: ClassTemplate,
                                  args: EvaluatedTemplateArgument[],
                                  node: Node): ClassType {
    const signature = args.map((x) => x.toString()).join(",");

    ctx.scopeManager.enterTempScope(classTemplate.contextScope, classTemplate.contextActiveScopes);
    ctx.scopeManager.enterUnnamedScope(true);
    for (let i = 0; i < args.length; i++) {
        const name = classTemplate.templateParams[i].name;
        const arg = args[i];
        if (arg instanceof Type) {
            ctx.scopeManager.define(name, arg);
        } else {
            ctx.scopeManager.define(name, new Variable(
                name, ctx.scopeManager.getFullName(name), ctx.fileName,
                classTemplate.templateParams[i].type, AddressType.CONSTANT, arg,
            ));
        }
    }
    let body = classTemplate.classBody;
    const spec = classTemplate.specializationMap.get(signature);
    if (spec) {
        body = spec;
    }
    // hack name
    const instanceName = body.identifier.name + "<" + signature + ">";
    const oldName = body.identifier.name;
    body.identifier.name = instanceName;
    const classType = body.codegen(ctx) as ClassType;
    body.identifier.name = oldName;
    ctx.scopeManager.currentScope.children.map((scope) =>
        ctx.scopeManager.currentScope.parent.children.push(scope));
    ctx.scopeManager.detachCurrentScope();
    ctx.scopeManager.exitScope();
    ctx.scopeManager.define(instanceName, classType, node);
    ctx.scopeManager.exitTempScope();
    return classType;
}

export function template() {
    return "template";
}
