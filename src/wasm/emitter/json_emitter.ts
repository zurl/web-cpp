import {Scope} from "../../codegen/scope";
import {SourceLocation} from "../../common/node";
import {SourceMap} from "../../common/object";
import {WFunction} from "../section/wfunction";
import {Control, getNativeType, WType} from "../tool/constant";
import {Emitter} from "./emitter";

export type WASMJSONInstruction = [number, number | string, number];

export interface WASMJSONFunction {
    name: string;
    fileName: string;
    displayName: string;
    locals: number[];
    codes: WASMJSONInstruction[];
    type: string;
    signatureId: number;
    lineIdx: Set<number>;
    dataStart: number;
    bssStart: number;
    scope: Scope | null;
    memoryInfo: Array<[number, number, number]>;
    sourceRange: [number, number];
}

export interface WASMJSON {
    functions: WASMJSONFunction[];
    types: string[];
    data: Array<{
        offset: number;
        data: ArrayBuffer;
    }>;
    globals: Array<{
        name: string,
        type: number,
        init: string,
    }>;
    imports: Array<{
        module: string;
        name: string;
        type: string;
    }>;
    exports: {
        [key: string]: number,
    };
}

export class JSONEmitter extends Emitter {
    public memoryInfo: Array<[number, number, number]>;
    public insBuffer: WASMJSONInstruction[];
    public wasmJSON: WASMJSON;
    public constructor(externMap: Map<string, number>, sourceMap: Map<string, SourceMap>) {
        super(externMap, sourceMap);
        this.memoryInfo = [];
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

    public writeByte(byte: number): void {
        // ignore
    }

    public writeBytes(bytes: number[]): void {
        // ignore
    }

    public createLengthSlot(): [number, number] {
        // ignore
        return [0, 0];
    }

    public emit(type: WType, value: number | string): void {
        // ignore
    }

    public fillLengthSlot(slot: [number, number]): void {
        // ignore
    }

    public emitIns(control: number, valueType: WType, value: number | string,
                   location: SourceLocation, align?: boolean): void {
        this.insBuffer.push([control, value, this.ctx.getStartLine(location)]);
    }

    public enterFunction(func: WFunction): void {
        this.ctx.setCurrentFunc(func);
        this.insBuffer = [];
    }

    public submitFunction(): void {
        // match the block/end pair
        const codes = this.insBuffer;
        const stack = [];
        for (let i = 0; i < codes.length; i++) {
            if (codes[i][0] === Control.if || codes[i][0] === Control.block || codes[i][0] === Control.loop) {
                stack.push(i);
            } else if (codes[i][0] === Control.else) {
                codes[stack[stack.length - 1]][1] = i;
                stack.pop();
                stack.push(i);
            } else if (codes[i][0] === Control.end) {
                codes[stack[stack.length - 1]][1] = i;
                stack.pop();
            }
        }
        codes.push([Control.return, 0, -1]);

        // build inverse idx
        const inverseIdx = new Set<number>();
        const lineIdx = new Set<number>();
        for (let i = 0; i < codes.length; i++) {
            if (codes[i][2] !== -1 && !inverseIdx.has(codes[i][2])) {
                inverseIdx.add(codes[i][2]);
                lineIdx.add(i);
            }
        }
        const func = this.ctx.getCurrentFunc();
        this.wasmJSON.functions.push({
            name: func.name,
            fileName: func.fileName,
            displayName: func.displayName,
            locals: func.local.map((x) => getNativeType(x)),
            codes,
            type: func.type.toEncoding(),
            signatureId: func.signatureId,
            lineIdx,
            dataStart: func.dataStart,
            bssStart: func.bssStart,
            scope: null,
            memoryInfo: this.memoryInfo,
            sourceRange: [this.ctx.getStartLine(func.location), this.ctx.getEndLine(func.location)],
        });
        this.memoryInfo = [];
        this.ctx.setCurrentFunc(null);
    }

    public getJSON(): WASMJSON {
        return this.wasmJSON;
    }

}
