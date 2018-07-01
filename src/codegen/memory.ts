/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
export class MemoryLayout {

    public stackScope: number[];
    public dataPtr: number;
    public bssPtr: number;
    public stackPtr: number;
    public data: DataView;
    public dataBuffer: ArrayBuffer;

    constructor(dataSize: number) {
        this.dataPtr = 0;
        this.bssPtr = 0;
        this.stackPtr = 0;
        this.stackScope = [];
        this.dataBuffer = new ArrayBuffer(dataSize);
        this.data = new DataView(this.dataBuffer);
    }

    public allocBSS(size: number): number {
        const result = this.bssPtr;
        this.bssPtr += size;
        return result;
    }

    public allocData(size: number): number {
        const result = this.dataPtr;
        this.dataPtr += size;
        return result;
    }

    public allocStack(size: number): number {
        if ( size % 4 !== 0 ) {
            size += 4 - (size % 4);     // align to 4;
        }
        const result = this.stackPtr;
        this.stackPtr -= size;
        return result;
    }

    public enterFunction() {
        this.stackPtr = 0;
        this.stackScope = [];
    }

    public enterInnerScope() {
        this.stackScope.push(this.stackPtr);
    }

    public exitInnerScope() {
        this.stackPtr = this.stackScope.pop() as number;
    }

}
