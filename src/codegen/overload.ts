/**
 *  @file cpp language function overloader
 *  @author zcy <zurl@live.com>
 *  Created at 21/07/2018
 */
import {SyntaxError} from "../common/error";
import {Node} from "../common/node";
import {FunctionEntity} from "../common/symbol";
import {FunctionTemplate} from "../common/template";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {PointerType, ReferenceType} from "../type/compound_type";
import {FunctionType} from "../type/function_type";
import {PrimitiveTypes} from "../type/primitive_type";
import {CompileContext} from "./context";
import {FunctionLookUpResult} from "./scope";
import {instantiateFunctionTemplate} from "./template/function_template_instantiation";
import {deduceFunctionTemplateParameters} from "./template/template_deduce";

export function doStrictTypeMatch(dst: Type, src: Type): boolean {
    if (dst instanceof ReferenceType) {
        dst = dst.elementType;
    }
    if (src instanceof ReferenceType) {
        src = src.elementType;
    }
    return dst.equals(src);
}

export function doWeakTypeMatch(dst: Type, src: Type): boolean {
    if (dst instanceof ReferenceType) {
        dst = dst.elementType;
    }
    if (src instanceof ReferenceType) {
        src = src.elementType;
    }
    return dst.compatWith(src);
}

export function doFunctionFilter(func: FunctionEntity, argus: Type[],
                                 funcs: FunctionLookUpResult,
                                 matcher: (dst: Type, src: Type) => boolean): boolean {
    if (func.type.isMemberFunction()) {
        const first = func.type.parameterTypes[0];
        if (funcs.instanceType === null || !(first instanceof PointerType)) {
            return false;
        }
        return first.elementType.compatWith(funcs.instanceType) &&
            func.type.parameterTypes.slice(1).every((t, i) => matcher(t, argus[i]));
    } else {
        return func.type.parameterTypes.every((t, i) => matcher(t, argus[i]));
    }
}

export function removeDuplicatedFunctions(funcs: FunctionEntity[]): FunctionEntity[] {
    const s = new Set<string>();
    const result = [] as FunctionEntity[];
    for (const func of funcs) {
        if (!s.has(func.fullName)) {
            result.push(func);
            s.add(func.fullName);
        }
    }
    return result;
}

export function doFunctionOverloadResolution(ctx: CompileContext,
                                             funcs: FunctionLookUpResult,
                                             argus: Type[], node: Node): FunctionEntity {
    // 1. filter parameter number

    // 1.1 lookup instance template function
    const signatureBase = funcs.templateArguments.map((x) => x.toString()).join(",");
    const t0 = [] as FunctionEntity[];
    const templates = [] as FunctionTemplate[];
    for (const func of funcs.functions) {
        if (func instanceof FunctionTemplate) {
            templates.push(func);
            for (const funcIns of func.instanceMap.keys()) {
                if (funcs.templateArguments.length === 0
                    || funcIns.startsWith(signatureBase)) {
                    t0.push(func.instanceMap.get(funcIns)!);
                }
            }
        }
    }
    const t1 = funcs.functions.filter((x) => !(x instanceof FunctionTemplate)) as FunctionEntity[];
    // make template after normal

    const t2 = t1.concat(t0);
    const f0 = t2.filter((func) =>
        (func.type.isMemberFunction() && func.type.parameterTypes.length === argus.length + 1)
        || (!func.type.isMemberFunction() && func.type.parameterTypes.length === argus.length)
        || func.type.variableArguments,
    );
    const f1 = removeDuplicatedFunctions(f0);

    // 2. strong type match

    const f2 = f1.filter((func) => doFunctionFilter(func, argus, funcs, doStrictTypeMatch));

    if (f2.length >= 1) {
        if (f2.length > 1) {
            ctx.raiseWarning(`call for ${funcs.functions[0].shortName} is ambiguous`, node);
        }
        return f2[0];
    }

    // 3. weak type match

    const g0 = f1.filter((func) => !func.type.isTemplateInstance);
    const f3 = g0.filter((func) => doFunctionFilter(func, argus, funcs, doWeakTypeMatch));

    if (f3.length >= 1) {
        if (f3.length > 1) {
            ctx.raiseWarning(`call for ${funcs.functions[0].shortName} is ambiguous`, node);
        }
        return f3[0];
    }

    // 4. var arguments

    const f4 = f1.filter((x) => x.type.variableArguments);

    // TODO:: not match the c++ standard
    if (f4.length >= 1) {
        if (f4.length > 1) {
            ctx.raiseWarning(`call for ${funcs.functions[0].shortName} is ambiguous`, node);
        }
        return f4[0];
    }

    // 5. passive template instance\
    const templateArgus = funcs.instanceType ? [new PointerType(funcs.instanceType), ...argus] : argus;
    for (const item of templates) {
        const mockFunctionType = new FunctionType(PrimitiveTypes.void, templateArgus, false);
        const params = deduceFunctionTemplateParameters(item, mockFunctionType, funcs.templateArguments, true);
        if (params !== null) {
            const signature = params.map((x) => x.toString()).join(",");
            if (!item.instanceMap.get(signature)) {
                // apply instance creation
                instantiateFunctionTemplate(ctx, item, params, node);
                return item.instanceMap.get(signature)!;
            }
        }
    }

    throw new SyntaxError(`no matching function for ${funcs.functions[0].shortName.split("@")[0]}`, node);
}

export function isFunctionExists(ctx: CompileContext, name: string, argus: Type[],
                                 instanceType: ClassType | null = null): boolean {
    const lookupResult = ctx.scopeManager.lookup(name);

    if ( !(lookupResult instanceof FunctionLookUpResult)) { return false; }
    try {
        lookupResult.instanceType = instanceType;
        doFunctionOverloadResolution(ctx, lookupResult, argus, {} as Node);
        return true;
    } catch (e) {
        return false;
    }
}
