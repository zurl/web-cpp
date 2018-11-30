import Long = require("long");
import {Scope} from "../codegen/scope";
import {AddressType, Variable} from "../common/symbol";
import {F32Binary, F32Unary, F64Binary, F64Unary, I32Binary, I32Unary, I64Binary, I64Unary, WType} from "../wasm";
import {doBinaryCompute, doLongBinaryCompute, doLongUnaryCompute, doUnaryCompute} from "../wasm/calculator";
import {
    Control,
    F32,
    F32Convert,
    F64,
    F64Convert,
    I32,
    I32Convert,
    I64,
    I64Convert,
    WLoadIns,
    WStoreIns,
} from "../wasm/constant";
import {WASMJSON, WASMJSONFunction} from "../wasm/emitter";
import {Runtime, RuntimeOptions} from "./runtime";

type WASMNumber = number | Long;

export interface StackItem {
    fn: WASMJSONFunction;
    scope: Scope | null;
    pc: number;
    locals: WASMNumber[];
    stack: WASMNumber[];
    controlFlow: number[];
}

export interface JSRuntimeOptions extends RuntimeOptions {
    program: WASMJSON;
    scope: Scope;
}

interface RunFunctionOptions {
    initHeap: boolean;

}

export class JSRuntime extends Runtime {
    public program: WASMJSON;
    public stack: StackItem[];
    public stackTop: StackItem;
    public globals: WASMNumber[];
    public convertArray: ArrayBuffer;
    public convertDataView: DataView;
    public options: JSRuntimeOptions;
    public spIndex: number;
    public returnValue: number;
    public rootScope: Scope;

    constructor(options: JSRuntimeOptions) {
        super(options);
        this.options = options;
        this.program = options.program;
        this.rootScope = options.scope;
        this.stack = [];
        this.spIndex = -1;
        for (let i = 0; i < this.program.globals.length; i++) {
            if (this.program.globals[i].name === "$sp") {
                this.spIndex = i;
            }
        }
        if (this.spIndex === - 1) {
            throw new Error("no $sp found");
        }
        this.globals = this.program.globals.map((x) => {
            if (x.type === WType.i64) {
                return Long.fromString(x.init);
            } else if (x.type === WType.i32) {
                return parseInt(x.init);
            } else {
                return parseFloat(x.init);
            }
        });
        this.returnValue = 0;
        this.convertArray = new ArrayBuffer(64);
        this.convertDataView = new DataView(this.convertArray);
        for (const seg of this.program.data) {
            this.memoryUint8Array.set(new Uint8Array(seg.data), seg.offset);
        }
        this.stack = [{
            fn: this.program.functions[0],
            pc: 0,
            locals: [],
            stack: [],
            controlFlow: [],
            scope: this.rootScope,
        }];
        this.stackTop = this.stack[0];
    }

    public get sp(): number {
        return this.globals[this.spIndex] as number;
    }

    public set sp(value: number) {
        this.globals[this.spIndex] = value;
    }

    public runStep(): boolean {
        // fetch
        const ins = this.stackTop.fn.codes[this.stackTop.pc];
        // decode & compute
        if (I32Binary.hasOwnProperty(ins[0]) || F32Binary.hasOwnProperty(ins[0]) || F64Binary.hasOwnProperty(ins[0])) {
            const b = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
            const a = this.stackTop.stack[this.stackTop.stack.length - 2] as number;
            this.stackTop.stack.pop();
            this.stackTop.stack[this.stackTop.stack.length - 1] = doBinaryCompute(ins[0], a, b);
        } else if (I64Binary.hasOwnProperty(ins[0])) {
            const b = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
            const a = this.stackTop.stack[this.stackTop.stack.length - 2] as Long;
            this.stackTop.stack.pop();
            this.stackTop.stack[this.stackTop.stack.length - 1] = doLongBinaryCompute(ins[0], a, b);
        } else if (I32Unary.hasOwnProperty(ins[0]) || F32Unary.hasOwnProperty(ins[0])
            || F64Unary.hasOwnProperty(ins[0])) {
            const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
            this.stackTop.stack[this.stackTop.stack.length - 1] = doUnaryCompute(ins[0], a);
        } else if (I64Unary.hasOwnProperty(ins[0])) {
            const a = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
            this.stackTop.stack[this.stackTop.stack.length - 1] = doLongUnaryCompute(ins[0], a);
        } else if (I32Convert.hasOwnProperty(ins[0]) || F32Convert.hasOwnProperty(ins[0])
            || F64Convert.hasOwnProperty(ins[0])) {
            if (ins[0] === I32Convert.wrap$i64 || ins[0] === F32Convert.convert_s$i64
                || ins[0] === F32Convert.convert_u$i64 || ins[0] === F64Convert.convert_s$i64
                || ins[0] === F64Convert.convert_u$i64) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
                this.stackTop.stack[this.stackTop.stack.length - 1] = a.toNumber();
            } else if (ins[0] === I32Convert.trunc_s$f32 || ins[0] === I32Convert.trunc_s$f64
                || ins[0] === I32Convert.trunc_u$f32 || ins[0] === I32Convert.trunc_u$f64) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.stackTop.stack[this.stackTop.stack.length - 1] = a | 0;
            } else if (ins[0] === I32Convert.reinterpret$f32) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.convertDataView.setFloat32(0, a);
                this.stackTop.stack[this.stackTop.stack.length - 1] = this.convertDataView.getInt32(0);
            } else if (ins[0] === F32Convert.reinterpret$i32) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.convertDataView.setInt32(0, a);
                this.stackTop.stack[this.stackTop.stack.length - 1] = this.convertDataView.getFloat32(0);
            } else if (ins[0] === F64Convert.reinterpret$i64) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as Long;
                this.convertDataView.setUint32(0, a.high);
                this.convertDataView.setUint32(4, a.low);
                this.stackTop.stack[this.stackTop.stack.length - 1] = this.convertDataView.getFloat64(0);
            }
        } else if (I64Convert.hasOwnProperty(ins[0])) {
            if (ins[0] === I64Convert.reinterpret$f64) {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.convertDataView.setFloat64(0, a);
                this.stackTop.stack[this.stackTop.stack.length - 1] =
                    Long.fromBits(this.convertDataView.getUint32(4), this.convertDataView.getUint32(0));
            } else {
                const a = this.stackTop.stack[this.stackTop.stack.length - 1] as number;
                this.stackTop.stack[this.stackTop.stack.length - 1] = Long.fromNumber(a);
            }
        } else if (ins[0] === I32.const || ins[0] === F32.const || ins[0] === F64.const) {
            this.stackTop.stack.push(ins[1] as number);
        } else if (ins[0] === I64.const) {
            this.stackTop.stack.push(Long.fromString(ins[1] as string));
        } else if (WLoadIns.has(ins[0])) {
            const addr = (this.stackTop.stack[this.stackTop.stack.length - 1] as number) + (ins[1] as number);
            let data: number = 0;
            if (ins[0] === I32.load8_s || ins[0] === I64.load8_s) {
                data = this.memory.getInt8(addr);
            } else if (ins[0] === I32.load8_u || ins[0] === I64.load8_u) {
                data = this.memory.getUint8(addr);
            } else if (ins[0] === I32.load16_s || ins[0] === I64.load16_s) { data = this.memory.getInt16(addr, true);
            } else if (ins[0] === I32.load16_u || ins[0] === I64.load16_u) { data = this.memory.getUint16(addr, true);
            } else if (ins[0] === I32.load || ins[0] === I64.load32_s) { data = this.memory.getInt32(addr, true);
            } else if (ins[0] === I64.load32_u) { data = this.memory.getUint32(addr, true);
            } else if (ins[0] === F32.load) { data = this.memory.getFloat32(addr, true);
            } else if (ins[0] === F64.load) { data = this.memory.getFloat64(addr, true);
            }

            if (ins[0] === I64.load) {
                this.stackTop.stack[this.stackTop.stack.length - 1] = Long.fromBits(
                    this.memory.getUint32(addr, true),
                    this.memory.getUint32(addr + 4, true),
                );
            } else if (ins[0] === I64.load32_u || ins[0] === I64.load32_s || ins[0] === I64.load16_u ||
                ins[0] === I64.load16_s || ins[0] === I64.load8_u || ins[0] === I64.load8_s) {
                this.stackTop.stack[this.stackTop.stack.length - 1] = Long.fromNumber(data);
            } else {
                this.stackTop.stack[this.stackTop.stack.length - 1] = data;
            }
        } else if (WStoreIns.has(ins[0])) {
            const data = this.stackTop.stack.pop() as WASMNumber;
            const addr = (this.stackTop.stack.pop() as number) + (ins[1] as number);
            this.stackTop.stack.pop();
            if (ins[0] === I32.store8) {
                this.memory.setUint8(addr, data as number);
            } else if (ins[0] === I32.store16) { this.memory.setUint16(addr, data as number, true);
            } else if (ins[0] === I32.store) { this.memory.setInt32(addr, data as number, true);
            } else if (ins[0] === F32.store) { this.memory.setFloat32(addr, data as number, true);
            } else if (ins[0] === F64.store) { this.memory.setFloat64(addr, data as number, true);
            } else if (ins[0] === I64.store8) { this.memory.setUint8(addr, (data as Long).toNumber());
            } else if (ins[0] === I64.store16) { this.memory.setUint16(addr, (data as Long).toNumber(), true);
            } else if (ins[0] === I64.store32) { this.memory.setUint32(addr, (data as Long).toNumber(), true);
            } else if (ins[0] === I64.store) {
                this.memory.setUint32(addr, (data as Long).high, true);
                this.memory.setUint32(addr + 4, (data as Long).low, true);
            }
        } else if (ins[0] === Control.set_local) {
            this.stackTop.locals[ins[1] as number] = this.stackTop.stack.pop() as WASMNumber;
        } else if (ins[0] === Control.tee_local) {
            this.stackTop.locals[ins[1] as number] = this.stackTop.stack[this.stackTop.stack.length - 1];
        } else if (ins[0] === Control.set_global) {
            const data = this.stackTop.stack.pop() as WASMNumber;
            this.globals[ins[1] as number] = data;
        } else if (ins[0] === Control.get_local) {
            this.stackTop.stack.push(this.stackTop.locals[ins[1] as number]);
        } else if (ins[0] === Control.get_global) {
            this.stackTop.stack.push(this.globals[ins[1] as number]);
        } else if (ins[0] === Control.drop) {
            this.stackTop.stack.pop();
        } else if (ins[0] === Control.nop) {
            // pass
        } else if (ins[0] === Control.block) {
            this.stackTop.controlFlow.push(ins[1] as number);
        } else if (ins[0] === Control.loop) {
            this.stackTop.controlFlow.push(this.stackTop.pc + 1);
        } else if (ins[0] === Control.br || ins[0] === Control.br_if) {
            const cond = (ins[0] === Control.br) ? true : this.stackTop.stack.pop() as number;
            if (cond) {
                for (let i = 0; i < ins[1]; i++) { this.stackTop.controlFlow.pop(); }
                this.stackTop.pc = this.stackTop.controlFlow[this.stackTop.controlFlow.length - 1] as number - 1;
            }
        } else if (ins[0] === Control.if) {
            this.stackTop.controlFlow.push(this.stackTop.pc);
            const cond = this.stackTop.stack.pop() as number;
            if (!cond) {
                // if false, jump to else + 1 or end + 1
                if (this.stackTop.fn.codes[ins[1] as number][0] === Control.else) {
                    this.stackTop.pc = ins[1] as number;
                } else {
                    this.stackTop.pc = ins[1] as number - 1;
                }
            }
        } else if (ins[0] === Control.else) {
            this.stackTop.pc = ins[1] as number - 1;
        } else if (ins[0] === Control.end) {
            this.stackTop.controlFlow.pop();
        } else if (ins[0] === Control.call || ins[0] === Control.call_indirect) {
            const funcIdx = ins[0] === Control.call_indirect ?
                this.stackTop.stack.pop() as number
                : ins[1] as number;
            const funcType = this.program.types[funcIdx];
            const args: WASMNumber[] = [];

            for (let i = 1; i < funcType.length; i++) {
                args.push(this.stackTop.stack.pop()!);
            }
            args.reverse(); // inverse call std
            if (funcIdx >= this.program.imports.length) {
                // internal call
                const fn = this.program.functions[funcIdx - this.program.imports.length];
                const scope = fn.name.substring(0, 2) === "::" ?
                    this.rootScope.getScope(fn.name.split("::").slice(1)) : null;
                this.stack.push({
                    fn,
                    pc: -1,
                    stack: [],
                    controlFlow: [],
                    locals: args,
                    scope,
                });
                this.stackTop = this.stack[this.stack.length - 1];
                for (let i = 0; i < this.stackTop.fn.locals.length; i++) {
                    if (this.stackTop.fn.locals[i] === WType.i64) {
                        this.stackTop.locals.push(Long.fromNumber(0));
                    } else {
                        this.stackTop.locals.push(0);
                    }
                }
            } else {
                // external call
                const funcMeta = this.program.imports[funcIdx];
                const func = this.importObjects[funcMeta.module][funcMeta.name];
                const ret = func.apply(this, args) as number;
                if (funcType.charAt(0) === "i" || funcType.charAt(0) === "f" || funcType.charAt(0) === "d") {
                    this.stackTop.stack.push(ret);
                } else if (funcType.charAt(0) === "l") {
                    this.stackTop.stack.push(Long.fromNumber(ret));
                }
            }
        } else if (ins[0] === Control.return) {
            let ret: WASMNumber = 0;
            const isVoid = this.stackTop.fn.type.charAt(0) === "v";
            if (!isVoid) {
                ret = this.stackTop.stack.pop()!;
            }
            this.stack.pop();
            if (this.stack.length === 0) {
                if (ret instanceof Long) { ret = ret.toNumber(); }
                this.returnValue = ret;
                return false;
            }
            this.stackTop = this.stack[this.stack.length - 1];
            if (!isVoid) {
                this.stackTop.stack.push(ret);
            }
        } else if (ins[0] === Control.br_table || ins[0] === Control.select) {
            throw new Error("WASM not support");
        }

        // next
        this.stackTop.pc ++;
        return true;
    }

    public prepareRunFunction(entry: string, initHeap: boolean = false) {
        if (!this.program.exports.hasOwnProperty(entry)) {
            throw new Error(`no entry:${entry} found`);
        }
        this.sp = parseInt(((this.memory.buffer.byteLength - 1) / 4) + "") * 4;
        if (initHeap) {
            this.heapAllocator.init(this);
        }
        this.stack = [{
            fn: this.program.functions[this.program.exports[entry] - this.program.imports.length],
            pc: 0,
            locals: [],
            stack: [],
            controlFlow: [],
            scope: this.rootScope,
        }];
        this.stackTop = this.stack[this.stack.length - 1];
    }

    public runFunction(entry: string, initHeap: boolean = false) {
        this.prepareRunFunction(entry, initHeap);
        while (this.runStep()) { continue; }
    }

    // run according to c++ abi
    public async run(): Promise<void> {
        this.heapStart = this.heapPointer = this.options.heapStart;
        this.runFunction("$start", true);
        this.runFunction(this.entry, false);
        this.files.map((file) => file.flush());
    }

    public getValueOfVariable(v: Variable, s: StackItem) {
        switch (v.addressType) {
            case AddressType.CONSTANT:

        }
    }

   // public getRuntimeInfo(): RuntimeInfo {

   // }

    public getCurrentLine(){
        return this.stackTop.fn.codes[this.stackTop.pc][2];
    }

    public prepareRunSingleStepMode() {
        this.heapStart = this.heapPointer = this.options.heapStart;
        this.runFunction("$start", true);
        this.prepareRunFunction(this.entry, false);
    }

    public runSingleStepMode(): boolean {
        while (this.runStep()) {
            if (this.stackTop.fn.lineIdx.has(this.stackTop.pc)) {
                this.files.map((file) => file.flush());
                return true;
            }
        }
        this.files.map((file) => file.flush());
        return false;
    }

}
