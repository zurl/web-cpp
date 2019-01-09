/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {WType} from "../wasm";

export class MemoryLayout {

    public stackScope: number[];
    public dataPtr: number;
    public bssPtr: number;
    public stackPtr: number;
    public localPtr: number;
    public data: DataView;
    public dataBuffer: ArrayBuffer;
    public stringMap: Map<string, number>;
    public localTypes: WType[];

    public MEMORY_$SP: number;
    public MEMORY_$BP: number;

    constructor(dataSize: number) {
        this.dataPtr = 0;
        this.stackPtr = 0;
        this.localPtr = 0;
        this.bssPtr = 0;
        this.stackScope = [];
        this.dataBuffer = new ArrayBuffer(dataSize);
        this.data = new DataView(this.dataBuffer);
        this.stringMap = new Map<string, number>();
        this.MEMORY_$BP = 0;
        this.MEMORY_$SP = 0;
        this.localTypes = [];
    }

    public allocData(size: number): number {
        const result = this.dataPtr;
        this.dataPtr += size;
        return result;
    }

    public allocBss(size: number): number {
        const result = this.bssPtr;
        this.bssPtr += size;
        return result;
    }

    public allocLocal(type: WType, param: boolean = false): number {
        if ( !param ) {
            this.localTypes.push(type);
        }
        return this.localPtr++;
    }

    public allocStack(size: number): number {
        if ( size % 4 !== 0 ) {
            size += 4 - (size % 4);     // align to 4;
        }
        this.stackPtr -= size;
        return this.stackPtr;
    }

    public allocString(str: string): number {
        const item = this.stringMap.get(str)!;
        if ( item !== undefined) { return item; }
        const addr = this.allocData(str.length + 1);
        this.setDataString(addr, str);
        this.stringMap.set(str, addr);
        return addr;
    }

    public setDataString(offset: number, value: string) {
        for (let i = 0; i < value.length; i ++) {
            this.data.setUint8(offset + i, value.charCodeAt(i));
        }
        this.data.setUint8(offset + value.length, 0);
    }

    public enterFunction() {
        this.stackScope.push(this.stackPtr);
        this.stackPtr = 0;
        this.localPtr = 0;
        this.localTypes = [];
    }

    public exitFunction() {
        this.stackPtr = this.stackScope.pop() as number;
    }

}
