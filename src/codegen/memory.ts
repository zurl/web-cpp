/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {WType} from "../wasm";

export interface FunctionMemoryState {
    stackPtr: number;
    localPtr: number;
    localTypes: WType[];
}

export class MemoryLayout {
    public states: FunctionMemoryState[];
    public currentState: FunctionMemoryState;
    public dataPtr: number;
    public bssPtr: number;
    public data: DataView;
    public dataBuffer: ArrayBuffer;
    public stringMap: Map<string, number>;

    public MEMORY_$SP: number;
    public MEMORY_$BP: number;

    constructor(dataSize: number) {
        this.dataPtr = 0;
        this.bssPtr = 0;
        this.dataBuffer = new ArrayBuffer(dataSize);
        this.data = new DataView(this.dataBuffer);
        this.stringMap = new Map<string, number>();
        this.MEMORY_$BP = 0;
        this.MEMORY_$SP = 0;
        this.currentState = {
            stackPtr: 0,
            localPtr: 0,
            localTypes: [],
        };
        this.states = [];
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
            this.currentState.localTypes.push(type);
        }
        return this.currentState.localPtr++;
    }

    public allocStack(size: number): number {
        if ( size % 4 !== 0 ) {
            size += 4 - (size % 4);     // align to 4;
        }
        this.currentState.stackPtr -= size;
        return this.currentState.stackPtr;
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

    // interrupt safe
    public enterFunction() {
        this.states.push(this.currentState);
        this.currentState = {
            stackPtr: 0,
            localPtr: 0,
            localTypes: [],
        };
    }

    // interrupt safe
    public exitFunction() {
        this.currentState = this.states.pop()!;
    }

}
