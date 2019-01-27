import {Runtime} from "../runtime/runtime";

// implementation of standard C lib "string.h"

export function memcpy(this: Runtime, dst: number, src: number, size: number): number {
    const subarray = this.memoryUint8Array.slice(src, src + size);
    this.memoryUint8Array.set(subarray, dst);
    return dst;
}

export function memmove(this: Runtime, dst: number, src: number, size: number): number {

    return dst;
}

export function memset(this: Runtime, ptr: number, value: number, size: number): number {
    const ch = value & 0xFF;
    for (let i = 0; i < size; i++) {
        this.memory.setUint8(ptr + i, ch);
    }
    return ptr;
}

export function strlen(this: Runtime, ptr: number): number {
    let ch = this.memory.getUint8(ptr);
    let len = 0;
    while (ch !== 0) {
        ptr ++; len ++;
        ch = this.memory.getUint8(ptr);
    }
    return len;
}

export function strcpy(this: Runtime, dst: number, src: number): number {
    let ddst = dst, ssrc = src;
    let ch = this.memory.getUint8(ssrc);
    while (ch !== 0) {
        this.memory.setUint8(ddst, ch);
        ssrc ++; ddst++;
        ch = this.memory.getUint8(ssrc);
    }
    return dst;
}

export function strcmp(this: Runtime, dst: number, src: number): number {
    let lhs = this.memory.getUint8(src);
    let rhs = this.memory.getUint8(dst);
    while (rhs === lhs && rhs !== 0) {
        src++;
        dst++;
        lhs = this.memory.getUint8(src);
        rhs = this.memory.getUint8(dst);
    }
    if (lhs > rhs) {
        return 1;
    } else if (lhs === rhs) {
        return 0;
    } else {
        return -1;
    }
}

export function strcat(this: Runtime, dst: number, src: number): number {
    let ddst = dst;
    let ch = this.memory.getUint8(ddst);
    while (ch !== 0) {
        ddst ++;
        ch = this.memory.getUint8(ddst);
    }
    ch = this.memory.getUint8(src);
    while (ch !== 0) {
        this.memory.setUint8(ddst, ch);
        ddst ++;
        src ++;
        ch = this.memory.getUint8(src);
    }
    this.memory.setUint8(ddst, 0);
    return dst;
}

export function strchr(this: Runtime, ptr: number, chr: number): number {
    let ch = this.memory.getUint8(ptr);
    while (ch !== 0) {
        if (ch === chr) {
            return ptr;
        }
        ptr ++;
        ch = this.memory.getUint8(ptr);
    }
    return 0;
}

export function strncpy(this: Runtime, dst: number, src: number, size: number): number {
    let flag = 0;
    for (let i = 0; i < size; i++) {
        const ch = this.memory.getUint8(src + i);
        if (ch === 0) {
            flag = 1;
        }
        if (flag) {
            this.memory.setUint8(dst + i, 0);
        } else {
            this.memory.setUint8(dst + i, ch);
        }
    }
    return dst;
}

export function strncmp(this: Runtime, dst: number, src: number, size: number): number {
    for (let i = 0; i < size; i++) {
        const lch = this.memory.getUint8(src + i);
        const rch = this.memory.getUint8(src + i);
        if (lch < rch) {
            return -1;
        }
        if (rch > lch) {
            return 1;
        }
    }
    return 0;
}