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
    Declarator,
    FunctionTemplateInstantiation,
    Node,
    ParameterDeclaration,
    TemplateArgument,
    TemplateDeclaration,
    TemplateParameterType,
    TypeName,
    TypeParameter,
} from "../../common/ast";
import {SyntaxError} from "../../common/error";
import {AddressType, FunctionEntity, Variable} from "../../common/symbol";
import {AccessControl, Type} from "../../type";
import {ArrayType, PointerType, ReferenceType} from "../../type/compound_type";
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
        // TODO:: init expression;
        return {
            name,
            type: resultType,
            init: null,
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

FunctionTemplateInstantiation.prototype.codegen = function(ctx: CompileContext) {
    const name = getDeclaratorIdentifierName(this.declarator);
    const lookupResult = ctx.scopeManager.lookupAnyName(name);
    if (!lookupResult) {
        throw new SyntaxError(`cannot find template ${name}`, this);
    }
    if (!(lookupResult instanceof FunctionLookUpResult)) {
        throw new SyntaxError(`${name} is not template`, this);
    }
    const args = getDeclaratorIdentifierArguments(this.declarator)
        .map((x) => evaluateTemplateArgument(ctx, x, this));
    const resultType = parseTypeFromSpecifiers(ctx, this.specifiers, this);
    if (resultType == null) {
        throw new SyntaxError(`illegal return type`, this);
    }
    const functionType = parseFunctionDeclarator(ctx, this.declarator, resultType);
    if (functionType == null) {
        throw new SyntaxError(`illegal function definition`, this);
    }
    for (const item of lookupResult.functions) {
        if (item instanceof FunctionTemplate) {
            const params = deduceFunctionTemplateParameters(item, functionType, args);
            if (params !== null) {
                // match_successful point;
                const signature = params.map((x) => x.toString()).join(",");
                const instanceName = item.name + "@" + signature + "@" + functionType.toMangledName();
                item.instanceMap.set(signature, new FunctionEntity(
                    instanceName,
                    item.contextScope.getFullName(instanceName),
                    ctx.fileName,
                    functionType, false, true,
                    AccessControl.Public,
                ));
                ctx.submitDeferInstantiationTask({funcTemplate: item, type: functionType, args: params});
                return;
            }
        }
    }
    throw new SyntaxError(`no matched function template`, this);
};

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
    defineFunction(ctx, type, funcTemplate.functionBody.body.body, AccessControl.Public, funcTemplate.functionBody);
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
                                                 args: EvaluatedTemplateArgument[])
    : EvaluatedTemplateArgument[] | null {
    if (args.length > functionTemplate.templateParams.length) {
        return null;
    }
    if (functionTemplate.type.parameterTypes.length !== functionType.parameterTypes.length) {
        return null;
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
        for (let i = 0; i < functionTemplate.type.parameterTypes.length; i++) {
            tryMatchTemplateType(templateParametersTable,
                functionTemplate.type.parameterTypes[i],
                functionType.parameterTypes[i]);
        }
    } catch (e) {
        return null;
    }
    for (let i = 0; i < args.length; i++) {
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
                                     instanceType: Type) {
    if (templateType instanceof FunctionType) {
        if (!(instanceType instanceof FunctionType)) {
            throw {};
        }
        if (instanceType.parameterTypes.length !== templateType.parameterTypes.length) {
            throw {};
        }
        tryMatchTemplateType(table, templateType.returnType, instanceType.returnType);
        for (let i = 0; i < templateType.parameterTypes.length; i++) {
            tryMatchTemplateType(table, templateType.parameterTypes[i], instanceType.parameterTypes[i]);
        }
    } else if (templateType instanceof PointerType) {
        if (instanceType instanceof PointerType) {
            tryMatchTemplateType(table, templateType.elementType, instanceType.elementType);
        } else {
            throw {};
        }
    } else if (templateType instanceof ReferenceType) {
        if (instanceType instanceof ReferenceType) {
            tryMatchTemplateType(table, templateType.elementType, instanceType.elementType);
        } else {
            throw {};
        }
    } else if (templateType instanceof ArrayType) {
        if (instanceType instanceof ArrayType) {
            tryMatchTemplateType(table, templateType.elementType, instanceType.elementType);
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
                if (!arg.equals(instanceType)) {
                    throw {};
                }
            }
        } else {
            throw {};
        }
    } else {
        if (!templateType.equals(instanceType)) {
            throw {};
        }
    }
}

export function template() {
    return "template";
}
