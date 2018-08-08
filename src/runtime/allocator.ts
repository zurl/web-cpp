/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 06/07/2018
 */
import {RuntimeError} from "../common/error";
import {Runtime} from "./runtime";

export abstract class HeapAllocator {
    public abstract init(vm: Runtime): void;
    public abstract allocHeap(vm: Runtime, size: number): number;
    public abstract getBlockSize(vm: Runtime, offset: number): number;
    public abstract freeHeap(vm: Runtime, offset: number): void;
}

export class LinkedHeapAllocator extends HeapAllocator {

    constructor() {
        super();
    }

    // +0 tag (0 => occupied, 1 => free);
    // +4 block size (not include meta)

    public init(vm: Runtime): void {
        vm.heapPointer += 0;
    }

    public allocHeap(vm: Runtime, size: number): number {
        let ptr = vm.heapStart;
        while (ptr < vm.heapPointer) {
            const tag = vm.memory.getUint32(ptr);
            const blkSize = vm.memory.getUint32(ptr + 4);
            if (tag === 1 && blkSize >= size + 8) {
                vm.memory.setUint32(ptr, 0);
                vm.memory.setUint32(ptr + 4, size);
                vm.memory.setUint32(ptr + size + 8, 1);
                vm.memory.setUint32(ptr + size + 8 + 4, blkSize - size - 8);
                return ptr + 8;
            } else if (tag === 1 && blkSize >= size) {
                vm.memory.setUint32(ptr, 0);
                return ptr + 8;
            }
            ptr = ptr + blkSize + 8;
        }
        if (vm.sp - vm.heapPointer <= size + 8) {
            throw new RuntimeError(`out of memory`);
        } else {
            const offset = vm.heapPointer;
            vm.memory.setUint32(vm.heapPointer, 0);
            vm.memory.setUint32(vm.heapPointer + 4, size);
            vm.heapPointer += size + 8;
            return offset + 8;
        }
    }

    public getBlockSize(vm: Runtime, offset: number): number {
        if ( !( offset >= vm.heapStart && offset <= vm.heapPointer)) {
            throw new RuntimeError(`free a blk not be malloc`);
        }
        let ptr = vm.heapStart, lastPtr = 0;
        while (ptr < offset - 8) {
            const blkSize = vm.memory.getUint32(ptr + 4);
            lastPtr = ptr;
            ptr = ptr + blkSize + 8;
        }
        if ( ptr !== offset - 8) {
            throw new RuntimeError(`free a blk not be malloc`);
        }
        return vm.memory.getUint32(ptr + 4);
    }

    public freeHeap(vm: Runtime, offset: number): void {
        if ( !( offset >= vm.heapStart && offset <= vm.heapPointer)) {
            throw new RuntimeError(`free a blk not be malloc`);
        }
        let ptr = vm.heapStart, lastPtr = 0;
        while (ptr < offset - 8) {
            const blkSize = vm.memory.getUint32(ptr + 4);
            lastPtr = ptr;
            ptr = ptr + blkSize + 8;
        }
        if ( ptr !== offset - 8) {
            throw new RuntimeError(`free a blk not be malloc`);
        }
        const lastTag = vm.memory.getUint32(lastPtr);
        const thisSize = vm.memory.getUint32(ptr + 4);
        const nextTag = vm.memory.getUint32(ptr + 8 + thisSize);
        if (lastTag === 1) {
            const lastSize = vm.memory.getUint32(lastPtr + 4);
            let newSize = lastSize + thisSize + 8;
            if ( nextTag === 1 ) {
                newSize += vm.memory.getUint32(ptr + 8 + thisSize + 4) + 8;
            }
            vm.memory.setUint32(lastPtr, 1);
            vm.memory.setUint32(lastPtr + 4, newSize);
        } else {
            let newSize = thisSize;
            if ( nextTag === 1 ) {
                newSize += vm.memory.getUint32(ptr + 8 + thisSize + 4) + 8;
            }
            vm.memory.setUint32(ptr, 1);
            vm.memory.setUint32(ptr + 4, newSize);
        }
    }
}

export class FastHeapAllocator extends LinkedHeapAllocator {

    private sizeLimit: number[];
    private poolSize: number[];
    private poolPtr: number[];
    private pool: Array<Set<number>>;
    private MAGIC_NUMBER: number;

    constructor() {
        super();
        this.sizeLimit = [32, 128, 512];
        this.poolSize =  [64, 1, 1];
        this.MAGIC_NUMBER = 12450;
        this.pool = [];
        this.poolPtr = [];
    }

    public init(vm: Runtime): void {
        super.init(vm);
        this.pool = this.sizeLimit.map((_, i) => this.createPool(vm, i));
    }

    public allocHeap(vm: Runtime, size: number): number {
        if ( size > this.sizeLimit[this.sizeLimit.length - 1]) {
            return super.allocHeap(vm, size);
        } else {
           let idx = 0;
           while ( this.sizeLimit[idx] < size ) { idx ++; }
           const pool = this.pool[idx];
           if (pool.size <= 0) {
               this.extendPool(vm, idx);
           }
           const offset = pool.keys().next().value;
           pool.delete(offset);
           return offset;
        }
    }

    public freeHeap(vm: Runtime, offset: number): void {
        const tag = vm.memory.getUint32(offset - 4);
        if ( tag >= this.MAGIC_NUMBER) {
            const idx = tag - this.MAGIC_NUMBER;
            if (idx < 0 || idx >= this.pool.length) {
                throw new RuntimeError(`free a blk not be malloc`);
            }
            this.pool[idx].add(offset);
        } else {
            super.freeHeap(vm, offset);
        }
    }

    public getBlockSize(vm: Runtime, offset: number): number {
        const tag = vm.memory.getUint32(offset - 4);
        if ( tag >= this.MAGIC_NUMBER) {
            const idx = tag - this.MAGIC_NUMBER;
            if (idx < 0 || idx >= this.pool.length) {
                throw new RuntimeError(`free a blk not be malloc`);
            }
            return this.poolSize[idx];
        } else {
            return super.getBlockSize(vm, offset);
        }
    }

    private createPool(vm: Runtime, index: number): Set<number> {
        const size = this.sizeLimit[index];
        const poolSize = this.poolSize[index];
        const result = new Set<number>();
        const memory = super.allocHeap(vm, (size + 4) * poolSize);
        this.poolPtr.push(memory);
        for (let i = 0; i < poolSize; i++) {
            const offset = memory + i * (size + 4);
            vm.memory.setUint32(offset, this.MAGIC_NUMBER + index);
            result.add(offset + 4);
        }
        return result;
    }

    private extendPool(vm: Runtime, index: number) {
        const size = this.sizeLimit[index];
        const poolSize = this.poolSize[index];
        const pool = this.pool[index];
        this.poolSize[index] *= 2;
        const memory = super.allocHeap(vm, (size + 4) * poolSize);
        this.poolPtr.push(memory);
        for (let i = 0; i < poolSize; i++) {
            const offset = memory + i * (size + 4);
            vm.memory.setUint32(offset, this.MAGIC_NUMBER + index);
            pool.add(offset + 4);
        }
    }
}
