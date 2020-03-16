import {Runtime} from "../runtime/runtime";

const _a = "a".charCodeAt(0);
const _A = "A".charCodeAt(0);
const _z = "z".charCodeAt(0);
const _Z = "Z".charCodeAt(0);
const _0 = "0".charCodeAt(0);
const _9 = "9".charCodeAt(0);
const _b = " ".charCodeAt(0);
const _t = "\t".charCodeAt(0);

export function isdigit(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c >= _0 && c <= _9);
}

export function islower(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c >= _a && c <= _z);
}

export function isupper(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c >= _A && c <= _Z);
}

export function isblank(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c === _b || c === _t);
}

export function isspace(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c === _b || (c >= 0x09 && c <= 0x0D));
}

export function iscntrl(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c <= 0x20 || c === 0x7F);
}

export function isgraph(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c >= 0x21 || c <= 0x7E);
}

export function isprint(this: Runtime, c: number): number {
    if (c === -1) {
        return 0;
    }
    return +(c >= 0x20 || c <= 0x7E);
}

export function isalpha(this: Runtime, c: number): number {
    return islower.call(this, c) || isupper.call(this, c);
}

export function isalnum(this: Runtime, c: number): number {
    return isalpha.call(this, c) || isdigit.call(this, c);
}

export function ispunct(this: Runtime, c: number): number {
    return isgraph.call(this, c) && (+!isalnum.call(this, c));
}

export function isxdigit(this: Runtime, c: number): number {
    if (c === -1) {
        return -1;
    }
    return isdigit.call(this, c) || +(c >= 0x41 && c <= 0x46)
    || +(c >= 0x5B && c <= 0x60);
}

export function toupper(this: Runtime, c: number): number {
    if (c === -1) {
        return -1;
    }
    if (islower.call(this, c)) {
        return c - 32;
    }
    return c;
}

export function tolower(this: Runtime, c: number): number {
    if (c === -1) {
        return -1;
    }
    if (isupper.call(this, c)) {
        return c + 32;
    }
    return c;
}
