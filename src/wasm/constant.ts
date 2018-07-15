import {WBinaryOperation} from "./expression";

export enum Control {
    unreachable = 0x0,
    nop = 0x1,
    block = 0x2,
    loop = 0x3,
    if = 0x4,
    else = 0x5,
    end = 0xb,
    br = 0xc,
    br_if = 0xd,
    br_table = 0xe,
    return = 0xf,
    call = 0x10,
    call_indirect = 0x11,
    drop = 0x1a,
    select = 0x1b,
    get_local = 0x20,
    set_local = 0x21,
    tee_local = 0x22,
    get_global = 0x23,
    set_global = 0x24,
    current_memory = 0x3f,
    grow_memory = 0x40,
}

export enum U32 {
    load = 0x28,
    load8_s = 0x2c,
    load8_u = 0x2d,
    load16_s = 0x2e,
    load16_u = 0x2f,
    store = 0x36,
    store8 = 0x3a,
    store16 = 0x3b,
}

export enum U64 {
    load = 0x29,
    load8_s = 0x30,
    load8_u = 0x31,
    load16_s = 0x32,
    load16_u = 0x33,
    load32_s = 0x34,
    load32_u = 0x35,
    store = 0x37,
    store8 = 0x3c,
    store16 = 0x3d,
    store32 = 0x3e,
}

export enum F32 {
    load = 0x2a,
    store = 0x38,
    const = 0x43,
}

export enum F64 {
    load = 0x2b,
    store = 0x39,
    const = 0x44,
}

export enum I32 {
    const = 0x41,
    load = 0x28,
    load8_s = 0x2c,
    load8_u = 0x2d,
    load16_s = 0x2e,
    load16_u = 0x2f,
    store = 0x36,
    store8 = 0x3a,
    store16 = 0x3b,
}

export enum I64 {
    const = 0x42,
    load = 0x29,
    load8_s = 0x30,
    load8_u = 0x31,
    load16_s = 0x32,
    load16_u = 0x33,
    load32_s = 0x34,
    load32_u = 0x35,
    store = 0x37,
    store8 = 0x3c,
    store16 = 0x3d,
    store32 = 0x3e,
}

export enum I32Binary {
    eq = 0x46,
    ne = 0x47,
    lt_s = 0x48,
    lt_u = 0x49,
    gt_s = 0x4a,
    gt_u = 0x4b,
    le_s = 0x4c,
    le_u = 0x4d,
    ge_s = 0x4e,
    ge_u = 0x4f,
    add = 0x6a,
    sub = 0x6b,
    mul = 0x6c,
    div_s = 0x6d,
    div_u = 0x6e,
    rem_s = 0x6f,
    rem_u = 0x70,
    and = 0x71,
    or = 0x72,
    xor = 0x73,
    shl = 0x74,
    shr_s = 0x75,
    shr_u = 0x76,
    rotl = 0x77,
    rotr = 0x78,
}

export enum I64Binary {
    eq = 0x51,
    ne = 0x52,
    lt_s = 0x53,
    lt_u = 0x54,
    gt_s = 0x55,
    gt_u = 0x56,
    le_s = 0x57,
    le_u = 0x58,
    ge_s = 0x59,
    ge_u = 0x5a,
    add = 0x7c,
    sub = 0x7d,
    mul = 0x7e,
    div_s = 0x7f,
    div_u = 0x80,
    rem_s = 0x81,
    rem_u = 0x82,
    and = 0x83,
    or = 0x84,
    xor = 0x85,
    shl = 0x86,
    shr_s = 0x87,
    shr_u = 0x88,
    rotl = 0x89,
    rotr = 0x8a,
}

export enum F32Binary {
    eq = 0x5b,
    ne = 0x5c,
    lt = 0x5d,
    gt = 0x5e,
    le = 0x5f,
    ge = 0x60,
    neg = 0x8c,
    floor = 0x8e,
    nearest = 0x90,
    add = 0x92,
    sub = 0x93,
    mul = 0x94,
    div = 0x95,
}

export enum F64Binary {
    eq = 0x61,
    ne = 0x62,
    lt = 0x63,
    gt = 0x64,
    le = 0x65,
    ge = 0x66,
    neg = 0x9a,
    floor = 0x9c,
    nearest = 0x9e,
    add = 0xa0,
    sub = 0xa1,
    mul = 0xa2,
    div = 0xa3,
}

export enum I32Unary {
    eqz = 0x45,
    clz = 0x67,
    ctz = 0x68,
    popcnt = 0x69,
}

export enum I32Convert {
    wrap$i64 = 0xa7,
    trunc_s$f32 = 0xa8,
    trunc_u$f32 = 0xa9,
    trunc_s$f64 = 0xaa,
    trunc_u$f64 = 0xab,
    reinterpret$f32 = 0xbc,
}

export enum I64Unary {
    eqz = 0x50,
    clz = 0x79,
    ctz = 0x7a,
    popcnt = 0x7b,
}

export enum I64Convert {
    extend_s$i32 = 0xac,
    extend_u$i32 = 0xad,
    trunc_s$f32 = 0xae,
    trunc_u$f32 = 0xaf,
    trunc_s$f64 = 0xb0,
    trunc_u$f64 = 0xb1,
    reinterpret$f64 = 0xbd,
}

export enum F32Unary {
    abs = 0x8b,
    ceil = 0x8d,
    trunc = 0x8f,
    sqrt = 0x91,
    min = 0x96,
    max = 0x97,
    copysign = 0x98,
}

export enum F32Convert {
    convert_s$i32 = 0xb2,
    convert_u$i32 = 0xb3,
    convert_s$i64 = 0xb4,
    convert_u$i64 = 0xb5,
    demote$f64 = 0xb6,
    reinterpret$i32 = 0xbe,
}

export enum F64Unary {
    abs = 0x99,
    ceil = 0x9b,
    trunc = 0x9d,
    sqrt = 0x9f,
    min = 0xa4,
    max = 0xa5,
    copysign = 0xa6,

}

export enum F64Convert {
    convert_s$i32 = 0xb7,
    convert_u$i32 = 0xb8,
    convert_s$i64 = 0xb9,
    convert_u$i64 = 0xba,
    promote$f32 = 0xbb,
    reinterpret$i64 = 0xbf,
}

export enum WType {
    i32 = 0x7F,
    i64 = 0x7E,
    f32 = 0x7D,
    f64 = 0x7C,
    u32 = 0x01,
    u64 = 0x02,
    i8 = 0x03,
    u8 = 0x04,
    i16 = 0x05,
    u16 = 0x06,
    none = 0x00,
}

export enum SectionCode {
    custom = 0x00,
    type = 0x01,
    import = 0x02,
    function = 0x03,
    table = 0x04,
    memory = 0x05,
    global = 0x06,
    export = 0x07,
    start = 0x08,
    element = 0x09,
    code = 0x0a,
    data = 0x0b,
}

export const WTypeMap = new Map<WType, any>([
    [WType.i32, I32],
    [WType.i64, I64],
    [WType.u32, U32],
    [WType.u64, U64],
    [WType.f32, F32],
    [WType.f64, F64],
]);
export type UnaryOperator = I32Unary | F32Unary | I64Unary | F64Unary;
export type BinaryOperator = I32Binary | F32Binary | I64Binary | F64Binary;
export type ConvertOperator = I32Convert | F32Convert | I64Convert | F64Convert;

function createMapItem(array: any, target: WType): Array<[number, WType]> {
    return Object.keys(array)
        .map((x) => parseInt(x))
        .filter((x) => x)
        .map((x) => [x, target] as [number, WType]);
}

export const OpTypeMap = new Map<UnaryOperator | BinaryOperator, WType>([
    ...createMapItem(I32Unary, WType.i32),
    ...createMapItem(I64Unary, WType.i64),
    ...createMapItem(F32Unary, WType.f32),
    ...createMapItem(F64Unary, WType.f64),
    ...createMapItem(I32Binary, WType.i32),
    ...createMapItem(I64Binary, WType.i64),
    ...createMapItem(F32Binary, WType.f32),
    ...createMapItem(F64Binary, WType.f64),
    ...createMapItem(I32Convert, WType.i32),
    ...createMapItem(I64Convert, WType.i64),
    ...createMapItem(F32Convert, WType.f32),
    ...createMapItem(F64Convert, WType.f64),
]);

export function getTypeConvertOpe(srcType: WType, dstType: WType): ConvertOperator | null {
    switch (srcType) {
        case WType.i32:
            switch (dstType) {
                case WType.i32: return null;
                case WType.u32: return null;
                case WType.i64: return I64Convert.extend_s$i32;
                case WType.u64: return I64Convert.extend_s$i32;
                case WType.f32: return F32Convert.convert_s$i32;
                case WType.f64: return F64Convert.convert_s$i32;
            }
            return null;
        case WType.u32:
            switch (dstType) {
                case WType.i32: return null;
                case WType.u32: return null;
                case WType.i64: return I64Convert.extend_u$i32;
                case WType.u64: return I64Convert.extend_u$i32;
                case WType.f32: return F32Convert.convert_u$i32;
                case WType.f64: return F64Convert.convert_u$i32;
            }
            return null;
        case WType.i64:
            switch (dstType) {
                case WType.i32: return I32Convert.wrap$i64;
                case WType.u32: return I32Convert.wrap$i64;
                case WType.i64: return null;
                case WType.u64: return null;
                case WType.f32: return F32Convert.convert_s$i64;
                case WType.f64: return F64Convert.convert_s$i64;
            }
            return null;
        case WType.u64:
            switch (dstType) {
                case WType.i32: return I32Convert.wrap$i64;
                case WType.u32: return I32Convert.wrap$i64;
                case WType.i64: return null;
                case WType.u64: return null;
                case WType.f32: return F32Convert.convert_u$i64;
                case WType.f64: return F64Convert.convert_u$i64;
            }
            return null;
        case WType.f32:
            switch (dstType) {
                case WType.i32: return I32Convert.trunc_s$f32;
                case WType.u32: return I32Convert.trunc_u$f32;
                case WType.i64: return I64Convert.trunc_s$f32;
                case WType.u64: return I64Convert.trunc_u$f32;
                case WType.f32: return null;
                case WType.f64: return F64Convert.promote$f32;
            }
            return null;
        case WType.f64:
            switch (dstType) {
                case WType.i32: return I32Convert.trunc_s$f64;
                case WType.u32: return I32Convert.trunc_u$f64;
                case WType.i64: return I64Convert.trunc_s$f64;
                case WType.u64: return I64Convert.trunc_u$f64;
                case WType.f32: return F32Convert.demote$f64;
                case WType.f64: return null;
            }
            return null;
    }
    return null;
}

export function getOpFromStr(op: string, type: WType): BinaryOperator| UnaryOperator | null {
    switch (getOperationType(type)) {
        case WType.i32:
            switch (op) {
                case "+": return I32Binary.add;
                case "-": return I32Binary.sub;
                case "*": return I32Binary.mul;
                case "/": return I32Binary.div_s;
                case "%": return I32Binary.rem_s;
                case "<": return I32Binary.lt_s;
                case ">": return I32Binary.gt_s;
                case "<=": return I32Binary.le_s;
                case ">=": return I32Binary.ge_s;
                case "==": return I32Binary.eq;
                case "!=": return I32Binary.ne;
                case "&": return I32Binary.and;
                case "|": return I32Binary.or;
                case "^": return I32Binary.xor;
                case ">>": return I32Binary.shr_s;
                case "<<": return I32Binary.shr_s;
                case "!": return I32Unary.eqz;
            }
            return null;
        case WType.u32:
            switch (op) {
                case "+": return I32Binary.add;
                case "-": return I32Binary.sub;
                case "*": return I32Binary.mul;
                case "/": return I32Binary.div_u;
                case "%": return I32Binary.rem_u;
                case "<": return I32Binary.lt_u;
                case ">": return I32Binary.gt_u;
                case "<=": return I32Binary.le_u;
                case ">=": return I32Binary.ge_u;
                case "==": return I32Binary.eq;
                case "!=": return I32Binary.ne;
                case "&": return I32Binary.and;
                case "|": return I32Binary.or;
                case "^": return I32Binary.xor;
                case ">>": return I32Binary.shr_u;
                case "<<": return I32Binary.shr_u;
                case "!": return I32Unary.eqz;
            }
            return null;
        case WType.i64:
            switch (op) {
                case "+": return I64Binary.add;
                case "-": return I64Binary.sub;
                case "*": return I64Binary.mul;
                case "/": return I64Binary.div_s;
                case "%": return I64Binary.rem_s;
                case "<": return I64Binary.lt_s;
                case ">": return I64Binary.gt_s;
                case "<=": return I64Binary.le_s;
                case ">=": return I64Binary.ge_s;
                case "==": return I64Binary.eq;
                case "!=": return I64Binary.ne;
                case "&": return I64Binary.and;
                case "|": return I64Binary.or;
                case "^": return I64Binary.xor;
                case ">>": return I64Binary.shr_s;
                case "<<": return I64Binary.shr_s;
                case "!": return I64Unary.eqz;
            }
            return null;
        case WType.u64:
            switch (op) {
                case "+": return I64Binary.add;
                case "-": return I64Binary.sub;
                case "*": return I64Binary.mul;
                case "/": return I64Binary.div_u;
                case "%": return I64Binary.rem_u;
                case "<": return I64Binary.lt_u;
                case ">": return I64Binary.gt_u;
                case "<=": return I64Binary.le_u;
                case ">=": return I64Binary.ge_u;
                case "==": return I64Binary.eq;
                case "!=": return I64Binary.ne;
                case "&": return I64Binary.and;
                case "|": return I64Binary.or;
                case "^": return I64Binary.xor;
                case ">>": return I64Binary.shr_u;
                case "<<": return I64Binary.shr_u;
            }
            return null;
        case WType.f32:
            switch (op) {
                case "+": return F32Binary.add;
                case "-": return F32Binary.sub;
                case "*": return F32Binary.mul;
                case "/": return F32Binary.div;
                case "<": return F32Binary.lt;
                case ">": return F32Binary.gt;
                case "<=": return F32Binary.le;
                case ">=": return F32Binary.ge;
                case "==": return F32Binary.eq;
                case "!=": return F32Binary.ne;
            }
            return null;
        case WType.f64:
            switch (op) {
                case "+": return F64Binary.add;
                case "-": return F64Binary.sub;
                case "*": return F64Binary.mul;
                case "/": return F64Binary.div;
                case "<": return F64Binary.lt;
                case ">": return F64Binary.gt;
                case "<=": return F64Binary.le;
                case ">=": return F64Binary.ge;
                case "==": return F64Binary.eq;
                case "!=": return F64Binary.ne;
            }
            return null;
    }
    return null;
}

export function getOperationType(type: WType): WType {
    switch (type) {
        case WType.u8:
        case WType.u16:
        case WType.u32: return WType.u32;
        case WType.i8:
        case WType.i16:
        case WType.i32: return WType.i32;
        case WType.f32: return WType.f32;
        case WType.f64: return WType.f64;
        case WType.i64: return WType.i64;
        case WType.u64: return WType.u64;
    }
    return WType.none;
}

export function getNativeType(type: WType): WType {
    switch (type) {
        case WType.u8:
        case WType.u16:
        case WType.u32:
        case WType.i8:
        case WType.i16:
        case WType.i32: return WType.i32;
        case WType.f32: return WType.f32;
        case WType.f64: return WType.f64;
        case WType.i64:
        case WType.u64: return WType.i64;
    }
    return WType.none;
}
