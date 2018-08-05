/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import 'babel-polyfill';
import {RuntimeError} from "../common/error";
import {ImportObject, Runtime} from "./runtime";
import {VMFile} from "./vmfile";

export class NativeRuntime extends Runtime {

    public wasmMemory: WebAssembly.Memory;
    public instance: WebAssembly.Instance | null;
    public entry: string;

    constructor(code: ArrayBuffer,
                memorySize: number,
                entry: string,
                importObjects?: ImportObject,
                files?: VMFile[]) {
        super(code, importObjects, 0, files);
        const that = this;
        this.entry = entry;

        // wrap importObject
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

        this.wasmMemory = new WebAssembly.Memory(
            {
                initial: 1,
                maximum: memorySize,
            });
        if (!this.importObjects.hasOwnProperty("system")) {
            this.importObjects["system"] = {};
        }
        this.importObjects["system"]["memory"] = this.wasmMemory;
        this.memoryBuffer = this.wasmMemory.buffer;
        this.memory = new DataView(this.memoryBuffer);
        this.memoryUint8Array = new Uint8Array(this.memoryBuffer);
        this.instance = null;
    }

    public async run(): Promise<void> {
        const asm = await WebAssembly.instantiate(this.code, this.importObjects);
        this.instance = asm.instance;
        const initSp = parseInt(((this.wasmMemory.buffer.byteLength - 1) / 4) + "") * 4;
        this.sp = initSp;
        asm.instance.exports["$start"]();
        this.sp = initSp;
        asm.instance.exports[this.entry]();
        //this.instance = null;
        this.files.map((file) => file.flush());
    }

    public get sp(): number {
        return this.instance!.exports.$get_sp();
    }

    public set sp(value: number) {
        this.instance!.exports.$set_sp(value);
    }

}
