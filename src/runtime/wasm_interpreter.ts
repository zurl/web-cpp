import {WASMJSON, WASMJSONFunction} from "../wasm/emitter";
import * as Long from "long";
import {F32Binary, F32Unary, F64Binary, F64Unary, I32Binary, I32Unary, I64Binary, I64Unary, WType} from "../wasm";
import {I32} from "../wasm/constant";
import {doBinaryCompute, doLongBinaryCompute, doLongUnaryCompute, doUnaryCompute} from "../wasm/calculator";


type WASMNumber = number | Long;

/*
todo list
   [0x0, "unreachable"],
    [0x1, "nop"],
    [0x2, "block"],
    [0x3, "loop"],
    [0x4, "if"],
    [0x5, "else"],
    [0xb, "end"],
    [0xc, "br"],
    [0xd, "br_if"],
    [0xe, "br_table"],
    [0xf, "return"],
    [0x10, "call"],
    [0x11, "call_indirect"],
    [0x1a, "drop"],
    [0x1b, "select"],
    [0x20, "get_local"],
    [0x21, "set_local"],
    [0x22, "tee_local"],
    [0x23, "get_global"],
    [0x24, "set_global"],
    [0x28, "i32.load"],
    [0x29, "i64.load"],
    [0x2a, "f32.load"],
    [0x2b, "f64.load"],
    [0x2c, "i32.load8_s"],
    [0x2d, "i32.load8_u"],
    [0x2e, "i32.load16_s"],
    [0x2f, "i32.load16_u"],
    [0x30, "i64.load8_s"],
    [0x31, "i64.load8_u"],
    [0x32, "i64.load16_s"],
    [0x33, "i64.load16_u"],
    [0x34, "i64.load32_s"],
    [0x35, "i64.load32_u"],
    [0x36, "i32.store"],
    [0x37, "i64.store"],
    [0x38, "f32.store"],
    [0x39, "f64.store"],
    [0x3a, "i32.store8"],
    [0x3b, "i32.store16"],
    [0x3c, "i64.store8"],
    [0x3d, "i64.store16"],
    [0x3e, "i64.store32"],
    [0x3f, "current_memory"],
    [0x40, "grow_memory"],
    [0x41, "i32.const"],
    [0x42, "i64.const"],
    [0x43, "f32.const"],
    [0x44, "f64.const"],
    [0x67, "i32.clz"],
    [0x68, "i32.ctz"],
    [0x69, "i32.popcnt"],
    [0x74, "i32.shl"],
    [0x75, "i32.shr_s"],
    [0x76, "i32.shr_u"],
    [0x77, "i32.rotl"],
    [0x78, "i32.rotr"],
    [0x79, "i64.clz"],
    [0x7a, "i64.ctz"],
    [0x7b, "i64.popcnt"],
    [0x86, "i64.shl"],
    [0x87, "i64.shr_s"],
    [0x88, "i64.shr_u"],
    [0x89, "i64.rotl"],
    [0x8a, "i64.rotr"],
    [0x8b, "f32.abs"],
    [0x8c, "f32.neg"],
    [0x8d, "f32.ceil"],
    [0x8e, "f32.floor"],
    [0x8f, "f32.trunc"],
    [0x90, "f32.nearest"],
    [0x91, "f32.sqrt"],
    [0x96, "f32.min"],
    [0x97, "f32.max"],
    [0x98, "f32.copysign"],
    [0x99, "f64.abs"],
    [0x9a, "f64.neg"],
    [0x9b, "f64.ceil"],
    [0x9c, "f64.floor"],
    [0x9d, "f64.trunc"],
    [0x9e, "f64.nearest"],
    [0x9f, "f64.sqrt"],
    [0xa4, "f64.min"],
    [0xa5, "f64.max"],
    [0xa6, "f64.copysign"],

    [0xa7, "i32.wrap_i64"],
    [0xa8, "i32.trunc_s_f32"],
    [0xa9, "i32.trunc_u_f32"],
    [0xaa, "i32.trunc_s_f64"],
    [0xab, "i32.trunc_u_f64"],
    [0xac, "i64.extend_s_i32"],
    [0xad, "i64.extend_u_i32"],
    [0xae, "i64.trunc_s_f32"],
    [0xaf, "i64.trunc_u_f32"],
    [0xb0, "i64.trunc_s_f64"],
    [0xb1, "i64.trunc_u_f64"],
    [0xb2, "f32.convert_s_i32"],
    [0xb3, "f32.convert_u_i32"],
    [0xb4, "f32.convert_s_i64"],
    [0xb5, "f32.convert_u_i64"],
    [0xb6, "f32.demote_f64"],
    [0xb7, "f64.convert_s_i32"],
    [0xb8, "f64.convert_u_i32"],
    [0xb9, "f64.convert_s_i64"],
    [0xba, "f64.convert_u_i64"],
    [0xbb, "f64.promote_f32"],
    [0xbc, "i32.reinterpret_f32"],
    [0xbd, "i64.reinterpret_f64"],
    [0xbe, "f32.reinterpret_i32"],
    [0xbf, "f64.reinterpret_i64"],
]);
 */

export interface StackItem {
    fn: WASMJSONFunction;
    pc: number;
    params: WASMNumber[];
    locals: WASMNumber[];
    stack: WASMNumber[];
}

class WASMInterpreter {
    public program: WASMJSON;
    public stack: StackItem[];
    public stackTop: StackItem;
    public globals: WASMNumber[];

    constructor(program: WASMJSON) {
        this.program = program;
        this.stack = [];
        this.globals = program.globals.map((x) => {
            if (x.type === WType.i64) {
                return Long.fromString(x.init);
            } else if (x.type == WType.i32) {
                return parseInt(x.init);
            } else {
                return parseFloat(x.init);
            }
        });
        this.stack = [{
            fn: this.program.functions[this.program.exports["$start"]],
            pc: 0,
            params: [],
            locals: [],
            stack: []
        }];
    }

    public start() {
        this.stack = [{
            fn: this.program.functions[this.program.exports["$start"]],
            pc: 0,
            params: [],
            locals: [],
            stack: []
        }];
        this.stackTop = this.stack[0];
    }

    public runStep() {
        // fetch
        const ins = this.stackTop.fn.codes[this.stackTop.pc];
        // decode & compute
        if(I32Binary.hasOwnProperty(ins[0]) || F32Binary.hasOwnProperty(ins[0]) || F64Binary.hasOwnProperty(ins[0])){
            const b = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
            const a = this.stackTop.stack[this.stackTop.stack.length - 2] as number;
            this.stackTop.stack.pop();
            this.stackTop.stack[this.stackTop.stack.length - 1] = doBinaryCompute(ins[0], a, b);
        }
        else if(I64Binary.hasOwnProperty(ins[0])){
            const b = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
            const a = this.stackTop.stack[this.stackTop.stack.length - 2] as Long;
            this.stackTop.stack.pop();
            this.stackTop.stack[this.stackTop.stack.length - 1] = doLongBinaryCompute(ins[0], a, b);
        }
        else if(I32Unary.hasOwnProperty(ins[0]) || F32Unary.hasOwnProperty(ins[0]) || F64Unary.hasOwnProperty(ins[0])){
            const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
            this.stackTop.stack[this.stackTop.stack.length - 1] = doUnaryCompute(ins[0], a);
        }
        else if(I64Unary.hasOwnProperty(ins[0])){
            const a = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
            this.stackTop.stack[this.stackTop.stack.length - 1] = doLongUnaryCompute(ins[0], a);
        }


        // next
        do {
            this.stackTop.pc++;
        }

    }

}