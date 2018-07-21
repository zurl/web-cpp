/**
 *  @file cpp language function overloader
 *  @author zcy <zurl@live.com>
 *  Created at 21/07/2018
 */
import {FunctionEntity, Type} from "../../common/type";
import {FunctionLookUpResult} from "../scope";

export function doFunctionOverLoadResolution(funcs: FunctionLookUpResult,
                                             argus: Type[]): FunctionEntity | null {
    // 1. filter parameter number
    const f1 = funcs.functions.filter((x) =>
        x.type.parameterTypes.length === argus.length);

    if (f1.length === 0) {
        return null;
    }

    // 2. strong type match

    const f2 = f1.filter((func) =>
        func.type.parameterTypes.every((t, i) => t.equals(argus[i])));

    if (f2.length > 0) {
        return f2[0];
    }

    // 3. weak type match

    const f3 = f1.filter((func) =>
        func.type.parameterTypes.every((t, i) => t.compatWith(argus[i])));

    if (f3.length > 0) {
        return f3[0];
    }

    return null;
}
