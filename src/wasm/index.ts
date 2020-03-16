/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 10/07/2018
 */
import {WType} from "./tool/constant";

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

export * from "./section/wcode_section";
export * from "./section/wexport_section";
export * from "./section/wimport_memory";
export * from "./section/wfunction";
export * from "./section/wimport_section";
export * from "./section/wdata_section";
export * from "./section/wexport_function";
export * from "./section/wfunction_type";
export * from "./section/wmemory_section";
export * from "./section/wfunction_section";
export * from "./section/wtable";
export * from "./section/wglobal_variable";
export * from "./section/welement_section";
export * from "./section/wimport_item";
export * from "./section/wimport_function";
export * from "./section/wsection";
export * from "./section/wtype_section";
export * from "./section/welement";
export * from "./section/wtable_section";
export * from "./section/wglobal_section";
export * from "./section/wdata_segment";
export * from "./emitter/emitter";
export * from "./emitter/emitter_context";
export * from "./emitter/wasm_emitter";
export * from "./emitter/json_emitter";
export * from "./statement/wreturn";
export * from "./statement/wstore";
export * from "./statement/wbr";
export * from "./statement/wexpr_statement";
export * from "./statement/wblock";
export * from "./statement/wset_local";
export * from "./statement/wset_global";
export * from "./statement/wloop";
export * from "./statement/wbr_if";
export * from "./statement/wif_else_block";
export * from "./statement/wstatement";
export * from "./statement/wdrop";
export * from "./expression/wget_address";
export * from "./expression/wget_function_address";
export * from "./expression/wexpression";
export * from "./expression/wget_global";
export * from "./expression/wempty_expression";
export * from "./expression/wfake_expression";
export * from "./expression/wunary_operation";
export * from "./expression/wbinary_operation";
export * from "./expression/wconst";
export * from "./expression/wconditional_expression";
export * from "./expression/wget_local";
export * from "./expression/wcall_indirect";
export * from "./expression/wload";
export * from "./expression/wcall";
export * from "./expression/wcovert_operation";
export * from "./tool/constant";
export * from "./module";
