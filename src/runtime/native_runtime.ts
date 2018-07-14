/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {RuntimeError} from "../common/error";
import {ImportObject, Runtime} from "./runtime";

export class NativeRuntime implements Runtime {
    public buffer: ArrayBuffer;
    public importObjects: ImportObject;

    constructor(buffer: ArrayBuffer, importObjects: ImportObject) {
        this.buffer = buffer;
        this.importObjects = importObjects;
    }

    public async run() {
        const asm = await WebAssembly.instantiate(this.buffer, this.importObjects);
        const exports = asm.instance.exports;
        if ( !exports.hasOwnProperty("main") ) {
            throw new RuntimeError(`No main function found`);
        }
        exports.main();
    }
}
