/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import "babel-polyfill";
import {Runtime, RuntimeOptions} from "./runtime";


export interface NativeRuntimeOptions extends RuntimeOptions {
    code: ArrayBuffer;
}

export class NativeRuntime extends Runtime {

    public wasmMemory: WebAssembly.Memory;
    public instance: WebAssembly.Instance | null;
    public code: ArrayBuffer;
    public options: NativeRuntimeOptions;

    constructor(options: NativeRuntimeOptions) {
        super(options);

        this.code = options.code;
        this.options = options;

        // wrap importObject
        this.wasmMemory = new WebAssembly.Memory(
            {
                initial: 1,
                maximum: options.memorySize,
            });
        if (!this.importObjects.hasOwnProperty("system")) {
            this.importObjects["system"] = {};
        }
        this.importObjects["system"]["memory"] = this.wasmMemory;
        this.memoryBuffer = this.wasmMemory.buffer;
        this.memory = new DataView(this.memoryBuffer);
        this.memoryUint8Array = new Uint8Array(this.memoryBuffer);
        this.instance = null;


        const that = this;
        const oldImportObject = this.importObjects;
        this.importObjects = {};
        for (const moduleName of Object.keys(oldImportObject)) {
            const module = oldImportObject[moduleName];
            this.importObjects[moduleName] = {};
            for (const funcName of Object.keys(module)) {
                const func = module[funcName] as Function;
                this.importObjects[moduleName][funcName] = function() {
                    return func.apply(that, Array.from(arguments));
                };
            }
        }
    }

    public async run(): Promise<void> {
        this.heapStart = this.heapPointer = this.options.heapStart;
        const asm = await WebAssembly.instantiate(this.code, this.importObjects);
        this.instance = asm.instance;
        const initSp = parseInt(((this.wasmMemory.buffer.byteLength - 1) / 4) + "") * 4;
        this.sp = initSp;
        this.heapAllocator.init(this);
        asm.instance.exports["$start"]();
        this.sp = initSp;
        asm.instance.exports[this.entry]();
        // this.instance = null;
        this.files.map((file) => file.flush());
    }

    public get sp(): number {
        return this.instance!.exports.$get_sp();
    }

    public set sp(value: number) {
        this.instance!.exports.$set_sp(value);
    }

}
