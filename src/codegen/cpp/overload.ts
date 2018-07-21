/**
 *  @file cpp language function overloader
 *  @author zcy <zurl@live.com>
 *  Created at 21/07/2018
 */
import {Node} from "../../common/ast";
import {SyntaxError} from "../../common/error";
import {FunctionEntity, ReferenceType, Type} from "../../common/type";
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

export function doFunctionOverLoadResolution(funcs: FunctionLookUpResult,
                                             argus: Type[], node: Node): FunctionEntity {
    // 1. filter parameter number
    const f1 = funcs.functions.filter((x) =>
        x.type.parameterTypes.length === argus.length
        || x.type.variableArguments,
    );

    if (f1.length === 0) {
        throw new SyntaxError(`no matching function for ${funcs.functions[0].name}`, node);
    }

    // 2. strong type match

    const f2 = f1.filter((func) =>
        func.type.parameterTypes.every((t, i) => doStrictTypeMatch(t, argus[i])));

    if (f2.length === 1) {
        return f2[0];
    }

    // 3. weak type match

    const f3 = f1.filter((func) =>
        func.type.parameterTypes.every((t, i) => doWeakTypeMatch(t, argus[i])));

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
