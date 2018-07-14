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
    eqz = 0x45,
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
    eqz = 0x50,
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
    clz = 0x67,
    ctz = 0x68,
    popcnt = 0x69,
    wrap$i64 = 0xa7,
    trunc_s$f32 = 0xa8,
    trunc_u$f32 = 0xa9,
    trunc_s$f64 = 0xaa,
    trunc_u$f64 = 0xab,
    reinterpret$f32 = 0xbc,
}

export enum I64Unary {
    clz = 0x79,
    ctz = 0x7a,
    popcnt = 0x7b,
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
    u32,
    u64,
    i8,
    u8,
    i16,
    u16,
    none,
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
]);
