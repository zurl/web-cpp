import * as Long from "long";
import {Runtime} from "../runtime/runtime";

const printfBuffer = new ArrayBuffer(1000);
const printfView = new DataView(printfBuffer);

function vprintf(this: Runtime) {
    let sp = this.sp;
    let formatptr = this.memory.getUint32(sp, true);
    sp += 4;
    let chr = this.memory.getUint8(formatptr);
    let size = 0;
    while ( chr !== 0) {
        if ( chr === "%".charCodeAt(0)) {
            formatptr ++;
            let chr2 = String.fromCharCode(this.memory.getUint8(formatptr));
            let intPart = 0, floatPart = 0, isFloat = false;
            if ( chr2 === "." || (
                chr2.charCodeAt(0) >= "0".charCodeAt(0) &&
                chr2.charCodeAt(0) <= "9".charCodeAt(0))) {
                while ( chr2 === "." || (
                    chr2.charCodeAt(0) >= "0".charCodeAt(0) &&
                    chr2.charCodeAt(0) <= "9".charCodeAt(0))) {
                    if ( chr2 === ".") {
                        isFloat = true;
                    } else if ( isFloat ) {
                        floatPart = floatPart * 10 + (+chr2);
                    } else {
                        intPart = intPart * 10 + (+chr2);
                    }
                    formatptr ++;
                    chr2 = String.fromCharCode(this.memory.getUint8(formatptr));
                }
            }
            let isLong = false;
            if ( chr2 === "l") {
                isLong = true;
                formatptr++;
                chr2 = String.fromCharCode(this.memory.getUint8(formatptr));
            }
            if (chr2 === "%") {
                printfView.setUint8(size, "%".charCodeAt(0));
                size ++;
            } else if (chr2 === "d" || chr2 === "i" || chr2 === "u" ||
                chr2 === "X" || chr2 === "x" || chr2 === "o"
                || chr2 === "p" || chr2 === "n") {
                let str: string;
                if (chr2 === "u" || chr2 === "X" || chr2 === "x" || chr2 === "o"
                    || chr2 === "p") {
                    let radix = 10;
                    if (chr2 === "X" || chr2 === "x" || chr2 === "p") {
                        radix = 16;
                    } else if (chr2 === "o") {
                        radix = 8;
                    }
                    if (!isLong) {
                        str = this.memory.getUint32(sp, true).toString(radix);
                        sp += 4;
                    } else {
                        const low = this.memory.getUint32(sp, true);
                        const high = this.memory.getUint32(sp + 4, true);
                        str = Long.fromBits(low, high).toString(radix);
                        sp += 8;
                    }
                } else {
                    if (!isLong) {
                        str = this.memory.getInt32(sp, true).toString();
                        sp += 4;
                    } else {
                        const low = this.memory.getUint32(sp, true);
                        const high = this.memory.getInt32(sp + 4, true);
                        str = Long.fromBits(low, high).toString();
                        sp += 8;
                    }
                }
                if (chr2 === "n") {
                    str = "";
                }
                for (let j = 0; j < str.length; j++) {
                    printfView.setUint8(size, str.charCodeAt(j));
                    size++;
                }
            } else if (chr2 === "s") {
                let strptr = this.memory.getInt32(sp, true);
                sp += 4;
                let strchr = this.memory.getUint8(strptr);
                while (strchr !== 0) {
                    printfView.setUint8(size, strchr);
                    size ++;
                    strptr++;
                    strchr = this.memory.getUint8(strptr);
                }
            } else if (chr2 === "f") {
                let str: string;
                str = this.memory.getFloat64(sp, true).toString();
                sp += 8;
                if ( floatPart !== 0) {
                    const tokens = str.split(".");
                    if (tokens.length >= 2) {
                        tokens[1] = tokens[1].substr(0, floatPart);
                    }
                    str = tokens.join(".");
                }
                for (let j = 0; j < str.length; j++) {
                    printfView.setUint8(size, str.charCodeAt(j));
                    size++;
                }
            } else {
                printfView.setUint8(size, "%".charCodeAt(0));
                size++;
                printfView.setUint8(size, chr2.charCodeAt(0));
                size ++;
            }
        } else {
            printfView.setUint8(size, chr);
            size ++;
        }
        formatptr ++;
        chr = this.memory.getUint8(formatptr);
    }
    return size;
}

export function printf(this: Runtime): number {
    const size = vprintf.apply(this);
    const file = this.files[1];
    return file.write(printfBuffer.slice(0, size));
}

export function sprintf(this: Runtime): number {
    const strptr = this.memory.getUint32(this.sp, true);
    this.sp += 4;
    const size = vprintf.apply(this);
    this.sp -= 4;
    for (let i = 0; i < size; i++) {
        this.memory.setUint8(strptr + i, printfView.getUint8(i));
    }
    return size;
}

const inputBuffer = new ArrayBuffer(10);
const inputView = new DataView(inputBuffer);

export function getchar(this: Runtime): number {
    if ( this.files[0].read(inputBuffer, 0, 1) === 0 ) {
        return -1;
    }
    return inputView.getUint8(0);
}

const CC_0 = "0".charCodeAt(0);
const CC_9 = "9".charCodeAt(0);
const CC_S = " ".charCodeAt(0);
const CC_TAB = "\t".charCodeAt(0);
const CC_NL = "\n".charCodeAt(0);
const CC_L = "-".charCodeAt(0);
const CC_P = ".".charCodeAt(0);

export function scanf(this: Runtime): number {
    let result = 0;
    let sp = this.sp;
    let formatptr = this.memory.getUint32(sp, true);
    sp += 4;
    let chr = this.memory.getUint8(formatptr);
    while ( chr !== 0) {
        if ( chr === "%".charCodeAt(0)) {
            formatptr ++;
            let chr2 = String.fromCharCode(this.memory.getUint8(formatptr));
            let isLong = false;
            if ( chr2 === "l") {
                isLong = true;
                formatptr++;
                chr2 = String.fromCharCode(this.memory.getUint8(formatptr));
            }
            if (chr2 === "d" || chr2 === "i" || chr2 === "u") {
                const controlCH = chr2;
                let val = Long.fromNumber(0);
                let isNeg = 0;
                let ch = getchar.apply(this), last = 0;
                while (ch !== -1 && !(ch >= CC_0 && ch <= CC_9)) {
                    last = ch;
                    ch = getchar.apply(this);
                }
                if ( last === CC_L) {
                    isNeg = 1;
                }
                while (ch !== -1 && ch >= CC_0 && ch <= CC_9) {
                    val = val.mul(10).add(ch - CC_0);
                    ch = getchar.apply(this);
                }
                const addr = this.memory.getInt32(sp, true);
                sp += 4;
                if ( isNeg ) {
                    val = val.neg();
                }
                if (controlCH === "u") {
                    if ( isLong ) {
                        this.memory.setUint32(addr, val.low, true);
                        this.memory.setUint32(addr + 4, val.high, true);
                    } else {
                        this.memory.setUint32(addr, val.toNumber(), true);
                    }
                } else {
                    if ( isLong ) {
                        this.memory.setInt32(addr, val.low, true);
                        this.memory.setUint32(addr + 4, val.high, true);
                    } else {
                        this.memory.setInt32(addr, val.toNumber(), true);
                    }
                }

                result ++;
            } else if (chr2 === "s") {
                let addr = this.memory.getInt32(sp, true);
                let ch = getchar.apply(this);
                while ( ch !== -1 && ch !== CC_NL && ch !== CC_S
                && ch !== CC_TAB) {
                    this.memory.setUint8(addr++, ch);
                    ch = getchar.apply(this);
                }
                result ++;
            } else if (chr2 === "f") {
                let val = 0;
                let isNeg = 0;
                let ch = getchar.apply(this), last = 0;
                while (ch !== -1 && !(ch >= CC_0 && ch <= CC_9 || ch === CC_P)) {
                    last = ch;
                    ch = getchar.apply(this);
                }
                if ( last === CC_L) {
                    isNeg = 1;
                }
                let havePoint = 0, base = 0.1;
                while (ch !== -1 &&
                ((ch >= CC_0 && ch <= CC_9) || (!havePoint && ch === CC_P))) {
                    if (ch === CC_P) {
                        havePoint = 1;
                    } else {
                        if (havePoint) {
                            val = val + (ch - CC_0) * base;
                            base /= 10;
                        } else {
                            val = val * 10 + ch - CC_0;
                        }
                    }
                    ch = getchar.apply(this);
                }
                const addr = this.memory.getInt32(sp, true);
                sp += 4;
                if ( isNeg ) {
                    val = -val;
                }
                if ( isLong ) {
                    this.memory.setFloat64(addr, val, true);
                } else {
                    this.memory.setFloat32(addr, val, true);
                }
                result ++;
            }
        }
        formatptr ++;
        chr = this.memory.getUint8(formatptr);
    }
    return result;
}
