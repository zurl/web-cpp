/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 08/07/2018
 */
import {RuntimeError} from "../common/error";
import {Runtime} from "../runtime/runtime";

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
                const str = this.memory.getInt32(sp, true).toString();
                sp += 4;
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
