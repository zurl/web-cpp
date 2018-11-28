/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceMapConsumer} from "source-map";
import {SourceLocation} from "../common/ast";
import {EmitError} from "../common/error";
import {SourceMap} from "../common/object";
import {WType} from "./constant";
import {writeLeb128Int, writeLeb128Uint} from "./leb128";
import {WFunction, WFunctionType} from "./section";
import {writeUtf8String} from "./utf8";

export interface Emitter {
    writeByte(byte: number): void;

    writeBytes(bytes: number[]): void;

    writeUint32(int: number): void;

    writeInt32(uint: number): void;

    writeUint64(int: string): void;

    writeInt64(uint: string): void;

    writeFloat32(float: number): void;

    writeFloat64(float: number): void;

    writeUtf8String(str: string): void;

    // assistant api

    setFuncIdx(name: string, type: WFunctionType): number;

    getFuncIdx(name: string): number;

    getFuncType(name: string): WFunctionType;

    setTypeIdxFromEncoding(encoding: string, idx: number): void;

    getTypeIdxFromEncoding(encoding: string): number;

    setCurrentFunc(func?: WFunction): void;

    getCurrentFunc(): WFunction;

    getGlobalType(name: string): WType;

    getGlobalIdx(name: string): number;

    setGlobalIdx(name: string, type: WType): void;

    getExternLocation(name: string): number;

    dump(str: string, loc?: SourceLocation): void;

    changeDumpIndent(delta: number): void;
}

export class WASMEmitter implements Emitter {
    public buffer: ArrayBuffer;
    public view: DataView;
    public now: number;
    public funcIdx: Map<string, [number, WFunctionType]>;
    public funcIdxCount: number;
    public globalIdx: Map<string, [number, WType]>;
    public globalIdxCount: number;
    public currentFunc?: WFunction;
    public externMap: Map<string, number>;
    public sourceMap?: Map<string, SourceMap>;
    public funcTypeEncodingMap: Map<string, number>;

    // dump

    public dumpIndent: number;
    public lastFile?: string;
    public lastLine: number;
    public consumer?: SourceMapConsumer;
    public source?: string[];
    public sourceMapItem?: SourceMap;

    constructor() {
        this.buffer = new ArrayBuffer(20000);
        this.view = new DataView(this.buffer);
        this.now = 0;
        this.funcIdx = new Map<string, [number, WFunctionType]>();
        this.funcIdxCount = 0;
        this.globalIdx = new Map<string, [number, WType]>();
        this.globalIdxCount = 0;
        this.externMap = new Map<string, number>();
        this.dumpIndent = 0;
        this.lastLine = 0;
        this.funcTypeEncodingMap = new Map<string, number>();
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

    public writeUint64(uint: string): void {
        writeLeb128Uint(this, uint);
    }

    public writeInt64(uint: string): void {
        writeLeb128Int(this, uint);
    }

    public writeFloat32(float: number): void {
        this.view.setFloat32(this.now, float, true);
        this.now += 4;
    }

    public writeFloat64(float: number): void {
        this.view.setFloat64(this.now, float, true);
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

    public getGlobalType(name: string): WType {
        if (!this.globalIdx.has(name)) {
            throw new EmitError(`undefined name ${name}`);
        }
        return this.globalIdx.get(name)![1];
    }

    public getGlobalIdx(name: string): number {
        if (!this.globalIdx.has(name)) {
            throw new EmitError(`undefined name ${name}`);
        }
        return this.globalIdx.get(name)![0];
    }

    public setGlobalIdx(name: string, type: WType): number {
        if (this.globalIdx.has(name)) {
            throw new EmitError(`duplicated name ${name}`);
        }
        this.globalIdx.set(name, [this.globalIdxCount, type]);
        return this.globalIdxCount++;
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

    public getExternLocation(name: string): number {
        const item = this.externMap.get(name);
        if (!item) {
            throw new EmitError(`unresolve symbol ${name}`);
        }
        return item;
    }

    public dumpSource(st: number, ed: number) {
        for (let i = st; i <= ed; i++) {
            console.log("# " + this.source![i].trim());
        }
    }

    public dump(str: string, loc?: SourceLocation) {
        let indent = "";
        for (let i = 0; i < this.dumpIndent; i++) {
            indent += " ";
        }
        if (this.sourceMap && loc) {
            if (!this.lastFile || loc.fileName !== this.lastFile) {
                this.lastFile = loc.fileName;
                if ( this.sourceMap.has(this.lastFile)) {
                    const item = this.sourceMap!.get(this.lastFile)!;
                    this.sourceMapItem = item;
                    this.source = item.source;
                    this.consumer = new SourceMapConsumer(
                        item.sourceMap.toString());
                    if ( item.lastLine ) {
                        this.lastLine = Math.max(0, item.lastLine);
                    } else {
                        this.lastLine = 0;
                    }
                } else {
                    this.lastLine = -1;
                }
            }
            if (this.consumer) {
                const mappedLine = this.consumer.originalPositionFor({
                    line: loc.start.line,
                    column: 1,
                }).line;
                if (this.lastLine !== -1 && mappedLine > this.lastLine) {
                    this.sourceMapItem!.lastLine = mappedLine;
                    const st = this.lastLine + 1;
                    const ed = mappedLine;
                    this.dumpSource(st, ed);
                    this.lastLine = mappedLine;
                }
            }
        }
        console.log(indent + str);
    }

    public changeDumpIndent(delta: number): void {
        this.dumpIndent += delta;
    }

    public getTypeIdxFromEncoding(encoding: string): number {
        const item = this.funcTypeEncodingMap.get(encoding);
        if (!item) {
            throw new EmitError(`unresolve type ${encoding}`);
        }
        return item;
    }

    public setTypeIdxFromEncoding(encoding: string, idx: number): void {
        this.funcTypeEncodingMap.set(encoding, idx);
    }

}

export type WASMInstruction = [number, number | string];

export interface WASMJSONFunction {
    name: string;
    locals: number[];
    codes: WASMInstruction[];
    type: string;
    signatureId: number;
}

export interface WASMJSON {
    functions: WASMJSONFunction[];
    types: string[];
    data: {
        offset: number;
        data: ArrayBuffer;
    }[];
    globals: {
        name: string,
        type: number,
        init: string,
    }[];
    imports: {
        module: string;
        name: string;
        type: string;
    }[];
    exports: {
        [key: string]: number
    };
}

export class JSONEmitter extends WASMEmitter{
    public insBuffer: WASMInstruction[];
    public wasmJSON: WASMJSON;
    public constructor(){
        super();
        this.insBuffer = [];
        this.wasmJSON = {
            functions: [],
            types: [],
            globals: [],
            imports: [],
            data: [],
            exports: {},
        };
    }
    public emitIns(ins: WASMInstruction): void{
        this.insBuffer.push(ins);
    }
    public setBuffer(insBuffer: WASMInstruction[]){
        this.insBuffer = insBuffer;
    }
    public getJSON(): WASMJSON{
        return this.wasmJSON;
    }
}