/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 10/07/2018
 */
import {WType} from "./constant";

export {
    F32Binary,
    F32Unary,
    F64Binary,
    F64Unary,
    I32Binary,
    I32Unary,
    I64Binary,
    I64Unary, WType,
} from "./constant";

export {
    WBinaryOperation,
    WUnaryOperation,
    WLoad,
    WConst,
    WCall,
} from "./expression";

export {
    WStore,
    WReturn,
    WBlock,
    WLoop,
    WIfElseBlock,
} from "./statement";

export {
    WModule,
    WFunction,
    WModuleConfig,
    WImportFunction,
    WGlobalVariable,
} from "./section";

export {
    WASMEmitter,
} from "./emitter";

export const i32 = WType.i32;
export const i64 = WType.i64;
export const f32 = WType.f32;
export const f64 = WType.f64;
export const u32 = WType.u32;
export const u64 = WType.u64;
export const i8 = WType.i8;
export const u8 = WType.u8;
export const i16 = WType.i16;
export const u16 = WType.u16;
