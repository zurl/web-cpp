import Bn = require("bn.js");

export interface ByteStream {
    view: DataView;
    now: number;
}

export function readLeb128Int(stream: ByteStream): Bn {
    const num = new Bn(0);
    let shift = 0;
    let byte;
    while (true) {
        byte = stream.view.getUint8(stream.now++);
        num.ior(new Bn(byte & 0x7f).shln(shift));
        shift += 7;
        if (byte >> 7 === 0) {
            break;
        }
    }
    // sign extend if negitive
    if (byte & 0x40) {
        num.setn(shift);
    }
    return num.fromTwos(shift);
}

export function writeLeb128Int(stream: ByteStream, number: number): void {
    let num = new Bn(number);
    const isNeg = num.isNeg();
    if (isNeg) {
        num = num.toTwos(num.bitLength() + 8);
    }
    while (true) {
        const i = num.maskn(7).toNumber();
        num.ishrn(7);
        if ((isNegOne(num) && (i & 0x40) !== 0) ||
            (num.isZero() && (i & 0x40) === 0)) {
            stream.view.setUint8(stream.now++, i);
            break;
        } else {
            stream.view.setUint8(stream.now++, i | 0x80);
        }
    }
    function isNegOne(x: Bn) {
        return isNeg && x.toString(2).indexOf("0") < 0;
    }
}

export function readLeb128Uint(stream: ByteStream): Bn {
    const num = new Bn(0);
    let shift = 0;
    let byte;
    while (true) {
        byte = stream.view.getUint8(stream.now++);
        num.ior(new Bn(byte & 0x7f).shln(shift));
        if (byte >> 7 === 0) {
            break;
        } else {
            shift += 7;
        }
    }
    return num;
}

export function writeLeb128Uint(stream: ByteStream, number: number): void {
    const num = new Bn(number);
    while (true) {
        const i = num.maskn(7).toNumber();
        num.ishrn(7);
        if (num.isZero()) {
            stream.view.setUint8(stream.now++, i);
            break;
        } else {
            stream.view.setUint8(stream.now++, i | 0x80);
        }
    }
}

export function getLeb128IntLength(number: number | string): number {
    let result = 0;
    let num = new Bn(number);
    const isNeg = num.isNeg();
    if (isNeg) {
        num = num.toTwos(num.bitLength() + 8);
    }
    while (true) {
        const i = num.maskn(7).toNumber();
        num.ishrn(7);
        if ((isNegOne(num) && (i & 0x40) !== 0) ||
            (num.isZero() && (i & 0x40) === 0)) {
            result++;
            break;
        } else {
            result++;
        }
    }
    function isNegOne(x: Bn) {
        return isNeg && x.toString(2).indexOf("0") < 0;
    }
    return result;
}

export function getLeb128UintLength(number: number): number {
    let result = 0;
    const num = new Bn(number);
    while (true) {
        const i = num.maskn(7).toNumber();
        num.ishrn(7);
        if (num.isZero()) {
            result++;
            break;
        } else {
            result++;
        }
    }
    return result;
}
