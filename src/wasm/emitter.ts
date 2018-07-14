/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {EmitError} from "../common/error";
import {writeLeb128Int, writeLeb128Uint} from "./leb128";
import {WFunction, WFunctionType} from "./section";
import {writeUtf8String} from "./utf8";

export interface Emitter {
    writeByte(byte: number): void;

    writeBytes(bytes: number[]): void;

    writeUint32(int: number): void;

    writeInt32(uint: number): void;

    writeUint64(int: number): void;

    writeInt64(uint: number): void;

    writeFloat32(float: number): void;

    writeFloat64(float: number): void;

    writeUtf8String(str: string): void;

    // assistant api

    setFuncIdx(name: string, type: WFunctionType): number;

    getFuncIdx(name: string): number;

    getFuncType(name: string): WFunctionType;

    setCurrentFunc(func?: WFunction): void;

    getCurrentFunc(): WFunction;
}

export class WASMEmitter implements Emitter {
    public buffer: ArrayBuffer;
    public view: DataView;
    public now: number;
    public funcIdx: Map<string, [number, WFunctionType]>;
    public funcIdxCount: number;
    public currentFunc?: WFunction;

    constructor() {
        this.buffer = new ArrayBuffer(1000);
        this.view = new DataView(this.buffer);
        this.now = 0;
        this.funcIdx = new Map<string, [number, WFunctionType]>();
        this.funcIdxCount = 0;
    }

    public writeByte(byte: number): void {
        this.view.setUint8(this.now++, byte);
    }

    public writeBytes(bytes: number[]): void {
        for (const byte of bytes) {
            this.view.setUint8(this.now++, byte);
        }
    }

    public writeUint32(uint: number): void {
        writeLeb128Uint(this, uint);
    }

    public writeInt32(uint: number): void {
        writeLeb128Int(this, uint);
    }

    public writeUint64(uint: number): void {
        writeLeb128Uint(this, uint);
    }

    public writeInt64(uint: number): void {
        writeLeb128Int(this, uint);
    }

    public writeFloat32(float: number): void {
        this.view.setFloat32(this.now, float);
        this.now += 4;
    }

    public writeFloat64(float: number): void {
        this.view.setFloat64(this.now, float);
        this.now += 8;
    }

    public writeUtf8String(str: string): void {
        writeUtf8String(this, str);
    }

    public getFuncType(name: string): WFunctionType {
        if (!this.funcIdx.has(name)) {
            throw new EmitError(`undefined name ${name}`);
        }
        return this.funcIdx.get(name)![1];
    }

    public getFuncIdx(name: string): number {
        if (!this.funcIdx.has(name)) {
            throw new EmitError(`undefined name ${name}`);
        }
        return this.funcIdx.get(name)![0];
    }

    public setFuncIdx(name: string, type: WFunctionType): number {
        if (this.funcIdx.has(name)) {
            throw new EmitError(`duplicated name ${name}`);
        }
        this.funcIdx.set(name, [this.funcIdxCount, type]);
        return this.funcIdxCount++;
    }

    public setCurrentFunc(func?: WFunction) {
        this.currentFunc = func;
    }

    public getCurrentFunc(): WFunction {
        if (!this.currentFunc) {
            throw new EmitError(`not in func`);
        }
        return this.currentFunc;
    }

}
