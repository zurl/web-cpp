import {InternalError} from "../../common/error";
import {Type} from "../../type";
import {ArrayType, LeftReferenceType, PointerType, ReferenceType, RightReferenceType} from "../../type/compound_type";
import {FunctionType} from "../../type/function_type";
import {TemplateParameterPlaceHolderType} from "../../type/template_type";
import {EvaluatedTemplateArgument} from "./template_argument";
import {FunctionTemplate} from "../../common/template";

export function deduceFunctionTypeOfTemplate(type: Type,
                                             params: EvaluatedTemplateArgument[]): Type {
    if (type instanceof FunctionType) {
        return new FunctionType(deduceFunctionTypeOfTemplate(type.returnType, params),
            type.parameterTypes.map((x) => deduceFunctionTypeOfTemplate(x, params)), type.variableArguments);
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

export function deduceFunctionTemplateParameters(functionTemplate: FunctionTemplate,
                                                 functionType: FunctionType,
                                                 args: EvaluatedTemplateArgument[],
                                                 weakMatch: boolean)
    : EvaluatedTemplateArgument[] | null {
    if (args.length > functionTemplate.templateParams.length) {
        return null;
    }
    const params = functionType.parameterTypes.filter(() => true);
    if (functionTemplate.functionConfig.functionType.parameterTypes.length !== params.length) {
        if (!weakMatch) {
            return null;
        } else {
            if (params.length > functionTemplate.functionConfig.functionType.parameterTypes.length) {
                return null;
            }
            for (let i = params.length; i < functionTemplate.functionConfig.functionType.parameterTypes.length; i++) {
                if (functionTemplate.functionConfig.parameterInits[i] !== null) {
                    params.push(functionTemplate.functionConfig.functionType.parameterTypes[i]);
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
                functionTemplate.functionConfig.functionType.parameterTypes[i],
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
