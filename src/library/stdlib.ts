import {Runtime} from "../runtime/runtime";

export function malloc(this: Runtime, size: number): number {
    return this.heapAllocator.allocHeap(this, size);
}

export function free(this: Runtime, ptr: number): void {
    return this.heapAllocator.freeHeap(this, ptr);
}

export function malloc_array(this: Runtime, element_size: number, length: number): number {
    const ptr = this.heapAllocator.allocHeap(this, element_size * length + 4);
    this.memory.setInt32(ptr, length, true);
    return ptr + 4;
}

export function srand(this: Runtime, ptr: number): void {
    return;
}

export function rand(this: Runtime): number {
    return parseInt((Math.random() * 0x7FFFFFFF) + "");
}
