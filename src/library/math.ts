import {Runtime} from "../runtime/runtime";

// implementation of standard C lib "math.h"

function _(text: string) {
    return function(this: Runtime, x: number): number {
        return (Math as any)[text](x);
    };
}
function __(text: string) {
    return function(this: Runtime, x: number, y: number): number {
        return (Math as any)[text](x, y);
    };
}

export const abs = _("abs");
export const cos = _("cos");
export const sin = _("sin");
export const tan = _("tan");
export const acos = _("acos");
export const asin = _("asin");
export const atan = _("atan");

export const cosh = _("cosh");
export const sinh = _("sinh");
export const tanh = _("tanh");
export const acosh = _("acosh");
export const asinh = _("asinh");
export const atanh = _("atanh");

export const cbrt = _("cbrt");
export const ceil = _("ceil");
export const exp = _("exp");
export const expm1 = _("expm1");
export const fabs = _("abs");
export const floor = _("floor");
export const log = _("log");
export const log10 = _("log10");
export const log1p = _("log1p");
export const log2 = _("log2");
export const logb = _("logb");
export const round = _("round");
export const sqrt = _("sqrt");
export const trunc = _("trunc");
export const atan2 = __("atan2");
export const pow = __("pow");
export const fmax = __("max");
export const fmin = __("min");
export const hypot = __("pow");
