/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
export class MemoryLayout {

    stackScope: number[];
    dataPtr: number;
    bssPtr: number;
    stackPtr: number;
    data: DataView;
    dataBuffer: ArrayBuffer;

    constructor(dataSize: number) {
        this.dataPtr = 0;
        this.bssPtr = 0;
        this.stackPtr = 0;
        this.stackScope = [];
        this.dataBuffer = new ArrayBuffer(dataSize);
        this.data = new DataView(this.dataBuffer);
    }

    allocBSS(size: number): number {
        const result = this.bssPtr;
        this.bssPtr += size;
        return result;
    }

    allocData(size: number): number {
        const result = this.dataPtr;
        this.dataPtr += size;
        return result;
    }

    allocStack(size: number): number {
        if( size < 4 ) size = 4;     // align to 4
        const result = this.stackPtr;
        this.stackPtr -= size;
        return result;
    }

    enterFunction() {
        this.stackPtr = 0;
        this.stackScope = [];
    }

    enterInnerScope() {
        this.stackScope.push(this.stackPtr);
    }

    exitInnerScope() {
        this.stackPtr = this.stackScope.pop() as number;
    }

}