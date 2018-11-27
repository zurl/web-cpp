import {WASMJSON, WASMJSONFunction} from "../wasm/emitter";
import * as Long from "long";
import {I32Binary, WType} from "../wasm";
import {I32} from "../wasm/constant";


type WASMNumber = number | Long;

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
        switch (ins[0]) {
            case I32.const:
                this.stackTop.stack.push(ins[1] as number);
            case I32Binary.add:
                const v1 =
                this.stackTop.stack.push(ins[1] as number);

        }
        // next
        do{
        this.stackTop.pc ++;

    }

}