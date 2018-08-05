/**
 *  @file cpp language function overloader
 *  @author zcy <zurl@live.com>
 *  Created at 21/07/2018
 */
import {Node} from "../../common/ast";
import {SyntaxError} from "../../common/error";
import {FunctionEntity} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType, ReferenceType} from "../../type/compound_type";
import {CompileContext} from "../context";
import {FunctionLookUpResult} from "../scope";

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

export function doFunctionOverloadResolution(funcs: FunctionLookUpResult,
                                             argus: Type[], node: Node): FunctionEntity {
    // 1. filter parameter number
    const f1 = funcs.functions.filter((func) =>
        (func.type.isMemberFunction() && func.type.parameterTypes.length === argus.length + 1)
        || (!func.type.isMemberFunction() && func.type.parameterTypes.length === argus.length)
        || func.type.variableArguments,
    );

    if (f1.length === 0) {
        throw new SyntaxError(`no matching function for ${funcs.functions[0].name}`, node);
    }

    // 2. strong type match

    const f2 = f1.filter((func) => doFunctionFilter(func, argus, funcs, doStrictTypeMatch));

    if (f2.length === 1) {
        return f2[0];
    }

    // 3. weak type match

    const f3 = f1.filter((func) => doFunctionFilter(func, argus, funcs, doWeakTypeMatch));

    if (f3.length === 1) {
        return f3[0];
    }

    // 4. var arguments

    const f4 = f1.filter((x) => x.type.variableArguments);

    if (f4.length === 1) {
        return f4[0];
    }

    if (f2.length > 1 || f3.length > 1 || f4.length > 1) {
        throw new SyntaxError(`call to ${funcs.functions[0].name} is ambiguous`, node);
    }

    throw new SyntaxError(`no matching function for ${funcs.functions[0].name}`, node);
}

export function isFunctionExists(ctx: CompileContext, name: string, argus: Type[],
                                 instanceType: ClassType | null = null): boolean {
    const lookupResult = ctx.scopeManager.lookupFullName(name);

    if ( !(lookupResult instanceof FunctionLookUpResult)) { return false; }
    try {
        lookupResult.instanceType = instanceType;
        doFunctionOverloadResolution(lookupResult, argus, {} as Node);
        return true;
    } catch (e) {
        return false;
    }
}
