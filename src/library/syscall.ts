/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 08/07/2018
 */
import BN = require("bn.js");
import {RuntimeError} from "../common/error";
import {Runtime} from "../runtime/runtime";
import {VMFile} from "../runtime/vmfile";

export function write(this: Runtime, fd: number, ptr: number, size: number): number {
    if (fd >= this.files.length) {
        return -1;
    }
    const file = this.files[fd];
    return file.write(this.memory.buffer.slice(ptr, ptr + size));
}

export function read(this: Runtime, fd: number, ptr: number, size: number): number {
    if (fd >= this.files.length) {
        return -1;
    }
    const file = this.files[fd];
    return file.read(this.memory.buffer, ptr, size);
}

export function memcpy(this: Runtime, dst: number, src: number, size: number) {
    const subarray = this. memoryUint8Array.slice(src, src + size);
    this.memoryUint8Array.set(subarray, dst);
}
export function malloc(this: Runtime, size: number): number {
    return this.heapAllocator.allocHeap(this, size);
}

export function free(this: Runtime, ptr: number): void {
    return this.heapAllocator.freeHeap(this, ptr);
}

const printfBuffer = new ArrayBuffer(1000);
const printfView = new DataView(printfBuffer);

export function printf(this: Runtime): number {
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
            } else if (chr2 === "d") {
                let str: string;
                if (!isLong) {
                    str = this.memory.getInt32(sp, true).toString();
                    sp += 4;
                } else {
                    const low = new BN(this.memory.getUint32(sp, true));
                    const high = new BN(this.memory.getInt32(sp + 4, true));
                    str = high.shln(32).add(low).toString();
                    sp += 8;
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
                if (!isLong) {
                    str = this.memory.getFloat32(sp, true).toString();
                    sp += 4;
                } else {
                    str = this.memory.getFloat64(sp, true).toString();
                    sp += 8;
                }
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
    const file = this.files[1];
    return file.write(printfBuffer.slice(0, size));
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
            if (chr2 === "d") {
                let val = 0, isNeg = 0;
                let ch = getchar.apply(this), last = 0;
                while (ch !== -1 && !(ch >= CC_0 && ch <= CC_9)) {
                    last = ch;
                    ch = getchar.apply(this);
                }
                if ( last === CC_L) {
                    isNeg = 1;
                }
                while (ch !== -1 && ch >= CC_0 && ch <= CC_9) {
                    val = val * 10 + ch - CC_0;
                    ch = getchar.apply(this);
                }
                const addr = this.memory.getInt32(sp, true);
                sp += 4;
                if ( isNeg ) {
                    this.memory.setInt32(addr, -val, true);
                } else {
                    this.memory.setInt32(addr, val, true);
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
            }
        }
        formatptr ++;
        chr = this.memory.getUint8(formatptr);
    }
    return result;
}

export function dump_stack_info(this: Runtime): void {
    console.log("$sp = " + this.sp);
}

export function time(this: Runtime, ptr: number): number {
    return Math.round((new Date()).getTime() / 1000);
}

export function malloc_array(this: Runtime, element_size: number, length: number): number {
    const ptr = this.heapAllocator.allocHeap(this, element_size * length + 4);
    this.memory.setInt32(ptr, length, true);
    return ptr + 4;
}
