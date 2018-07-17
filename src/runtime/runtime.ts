/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {VMFile} from "./vmfile";
import {fromBytesToString} from "../common/utils";

export interface ImportObject {
    [module: string]: {
        [name: string]: any,
    };
}

export abstract class Runtime {
    public memory: DataView;
    public memoryBuffer: ArrayBuffer;
    public heapStart: number;
    public heapPointer: number;

    public code: ArrayBuffer;
    public importObjects: ImportObject;
    public files: VMFile[];

    constructor(code: ArrayBuffer,
                importObjects: ImportObject = {},
                memorySize: number = 1024 * 1024,
                files: VMFile[] = []) {
        this.memoryBuffer = new ArrayBuffer(memorySize);
        this.memory = new DataView(this.memoryBuffer);
        this.heapStart = 0;
        this.heapPointer = 0;
        this.code = code;
        this.importObjects = importObjects;
        this.files = files;
    }

    public abstract async run(): Promise<void>;

    public abstract get sp(): number;

    public abstract set sp(value: number);

    public readMemoryString(ptr: number): string {
        return fromBytesToString(this.memory, ptr);
    }
}
