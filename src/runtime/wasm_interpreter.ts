import {WASMJSON, WASMJSONFunction} from "../wasm/emitter";
import * as Long from "long";
import {F32Binary, F32Unary, F64Binary, F64Unary, I32Binary, I32Unary, I64Binary, I64Unary, WType} from "../wasm";
import {
    F32,
    F32Convert,
    F64,
    F64Convert,
    I32,
    I32Convert,
    I64,
    I64Convert,
    WLoadIns,
    WStoreIns
} from "../wasm/constant";
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
    [0x24, "set_global"]
]);
 */

export interface StackItem {
    fn: WASMJSONFunction;
    pc: number;
    params: WASMNumber[];
    locals: WASMNumber[];
    stack: WASMNumber[];
}

export interface WASMInterpreterOptions{
    heapSize: number;
}

class WASMInterpreter {
    public program: WASMJSON;
    public stack: StackItem[];
    public stackTop: StackItem;
    public globals: WASMNumber[];
    public convertArray: ArrayBuffer;
    public convertDataView: DataView;
    public options: WASMInterpreterOptions;
    public heapArray: ArrayBuffer;
    public heapDataView: DataView;

    constructor(program: WASMJSON, options: WASMInterpreterOptions) {
        this.program = program;
        this.options = options;
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
        this.stackTop = this.stack[0];
        this.convertArray = new ArrayBuffer(64);
        this.convertDataView = new DataView(this.convertArray);
        this.heapArray = new ArrayBuffer(options.heapSize);
        this.heapDataView = new DataView(this.heapArray);
        for(const seg of this.program.data){
            new Uint8Array(this.heapArray).set(new Uint8Array(seg.data), seg.offset);
        }
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
        else if(I32Convert.hasOwnProperty(ins[0]) || F32Convert.hasOwnProperty(ins[0]) || F64Convert.hasOwnProperty(ins[0])) {
            if (ins[0] == I32Convert.wrap$i64 || ins[0] == F32Convert.convert_s$i64 || ins[0] == F32Convert.convert_u$i64
                || ins[0] == F64Convert.convert_s$i64 || ins[0] == F64Convert.convert_u$i64) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
                this.stackTop.stack[this.stackTop.stack.length - 1] = a.toNumber();
            }
            else if (ins[0] == I32Convert.trunc_s$f32 || ins[0] == I32Convert.trunc_s$f64
                || ins[0] == I32Convert.trunc_u$f32 || ins[0] == I32Convert.trunc_u$f64) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.stackTop.stack[this.stackTop.stack.length - 1] = a | 0;
            }
            else if (ins[0] == I32Convert.reinterpret$f32){
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.convertDataView.setFloat32(0, a);
                this.stackTop.stack[this.stackTop.stack.length - 1] = this.convertDataView.getInt32(0);
            }
            else if (ins[0] == F32Convert.reinterpret$i32){
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.convertDataView.setInt32(0, a);
                this.stackTop.stack[this.stackTop.stack.length - 1] = this.convertDataView.getFloat32(0);
            }
            else if (ins[0] == F64Convert.reinterpret$i64){
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
                this.convertDataView.setUint32(0, a.high);
                this.convertDataView.setUint32(4, a.low);
                this.stackTop.stack[this.stackTop.stack.length - 1] = this.convertDataView.getFloat64(0);
            }
        }
        else if(I64Convert.hasOwnProperty(ins[0])){
            if(ins[0] == I64Convert.reinterpret$f64){
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.convertDataView.setFloat64(0, a);
                this.stackTop.stack[this.stackTop.stack.length - 1] =
                    Long.fromBits(this.convertDataView.getUint32(4), this.convertDataView.getUint32(0));
            }
            else {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.stackTop.stack[this.stackTop.stack.length - 1] = Long.fromNumber(a);
            }
        }
        else if(ins[0] == I32.const|| ins[0] == F32.const || ins[0] == F64.const){
            this.stackTop.stack.push(ins[1] as number);
        }
        else if(ins[0] == I64.const){
            this.stackTop.stack.push(Long.fromString(ins[1] as string));
        }
        else if(WLoadIns.has(ins[0])){
            const addr = (this.stackTop.stack[this.stackTop.stack.length - 1] as number) + (ins[1] as number);
            let data: number = 0;
            if(ins[0] == I32.load8_s || ins[0] == I64.load8_s) data = this.heapDataView.getInt8(addr);
            else if(ins[0] == I32.load8_u || ins[0] == I64.load8_u) data = this.heapDataView.getUint8(addr);
            else if(ins[0] == I32.load16_s || ins[0] == I64.load16_s) data = this.heapDataView.getInt16(addr);
            else if(ins[0] == I32.load16_u || ins[0] == I64.load16_u) data = this.heapDataView.getUint16(addr);
            else if(ins[0] == I32.load || ins[0] == I64.load32_s) data = this.heapDataView.getInt32(addr);
            else if(ins[0] == I64.load32_u) data = this.heapDataView.getUint32(addr);
            else if(ins[0] == F32.load) data = this.heapDataView.getFloat32(addr);
            else if(ins[0] == F64.load) data = this.heapDataView.getFloat64(addr);

            if(ins[0] == I64.load){
                this.stackTop.stack[this.stackTop.stack.length - 1] = Long.fromBits(
                    this.heapDataView.getUint32(addr + 4),
                    this.heapDataView.getUint32(addr)
                );
            }
            else if(ins[0] == I64.load32_u || ins[0] == I64.load32_s || ins[0] == I64.load16_u ||
                ins[0] == I64.load16_s || ins[0] == I64.load8_u || ins[0] == I64.load8_s){
                this.stackTop.stack[this.stackTop.stack.length - 1] = Long.fromNumber(data);
            }
            else {
                this.stackTop.stack[this.stackTop.stack.length - 1] = data;
            }
        }
        else if(WStoreIns.has(ins[0])){
            const data = this.stackTop.stack[this.stackTop.stack.length - 1];
            this.stackTop.stack.pop();
            const addr = (this.stackTop.stack[this.stackTop.stack.length - 1] as number) + (ins[1] as number);
            this.stackTop.stack.pop();
            if(ins[0] == I32.store8) this.heapDataView.setUint8(addr, data as number);
            else if(ins[0] == I32.store16) this.heapDataView.setUint16(addr, data as number);
            else if(ins[0] == I32.store) this.heapDataView.setInt32(addr, data as number);
            else if(ins[0] == F32.store) this.heapDataView.setFloat32(addr, data as number);
            else if(ins[0] == F64.store) this.heapDataView.setFloat64(addr, data as number);
            else if(ins[0] == I64.store8) this.heapDataView.setUint8(addr, (data as Long).toNumber());
            else if(ins[0] == I64.store16) this.heapDataView.setUint16(addr, (data as Long).toNumber());
            else if(ins[0] == I64.store32) this.heapDataView.setUint32(addr, (data as Long).toNumber());
            else if(ins[0] == I64.store) {
                this.heapDataView.setUint32(addr, (data as Long).high);
                this.heapDataView.setUint32(addr + 4, (data as Long).low);
            }
        }

    }

}