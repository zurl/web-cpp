/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {fromBytesToString} from "../common/utils";
import {FastHeapAllocator, HeapAllocator} from "./allocator";
import {VMFile} from "./vmfile";

export interface ImportObject {
    [module: string]: {
        [name: string]: any,
    };
}

export abstract class Runtime {
    public memory: DataView;
    public memoryUint8Array: Uint8Array;
    public memoryBuffer: ArrayBuffer;
    public heapStart: number;
    public heapPointer: number;

    public code: ArrayBuffer;
    public importObjects: ImportObject;
    public files: VMFile[];
    public heapAllocator: HeapAllocator;

    constructor(code: ArrayBuffer,
                importObjects: ImportObject = {},
                memorySize: number = 1024 * 1024,
                files: VMFile[] = []) {
        this.memoryBuffer = new ArrayBuffer(memorySize);
        this.memoryUint8Array = new Uint8Array(this.memoryBuffer);
        this.memory = new DataView(this.memoryBuffer);
        this.heapStart = 0;
        this.heapPointer = 0;
        this.code = code;
        this.importObjects = importObjects;
        this.files = files;
        this.heapAllocator = new FastHeapAllocator();
    }

    public abstract async run(): Promise<void>;

    public abstract get sp(): number;

    public abstract set sp(value: number);

    public readMemoryString(ptr: number): string {
        return fromBytesToString(this.memory, ptr);
    }
}
