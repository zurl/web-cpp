
const {LinkedHeapAllocator, FastHeapAllocator} = require("../../dist/runtime/allocator");
const {Runtime} = require("../../dist/runtime/runtime");
const {assert} = require("chai");

function printLayout(memory, st, ed){
    let ptr = st;
    while (ptr < ed) {
        const tag = memory.getUint32(ptr);
        const blkSize = memory.getUint32(ptr + 4);
        console.log(`#${ptr} => (${tag}, ${blkSize})`);
        ptr = ptr + blkSize + 8;
    }
    console.log(`==========`);
}

describe('heap allocator', function () {
    it('it should be works', function () {
        const allocator = new LinkedHeapAllocator();
        const buffer = new ArrayBuffer(1000);
        const vm = new Runtime({
            heapStart: 0
        });
        vm.memoryBuffer = buffer;
        vm.memory = new DataView(buffer);
        vm.memoryUint8Array = new Uint8Array(buffer);
        vm.sp = 10000;
        vm.heapStart = 100;
        vm.heapPointer = 100;
        const a1 = allocator.allocHeap(vm, 10);
        const a2 = allocator.allocHeap(vm, 30);
        const a3 = allocator.allocHeap(vm, 70);
        const a4 = allocator.allocHeap(vm, 90);
        //printLayout(vm.memory, vm.heapStart, vm.heapPointer);
        assert.equal(JSON.stringify([a1,a2,a3,a4]), JSON.stringify([108,126,164,242]));
        allocator.freeHeap(vm, a3);
        const a5 = allocator.allocHeap(vm, 80);
        const a6 = allocator.allocHeap(vm, 60);
        assert.equal(JSON.stringify([a5, a6]), JSON.stringify([340, 164]));
        allocator.freeHeap(vm, a1);
        allocator.freeHeap(vm, a2);
        allocator.freeHeap(vm, a6);
        const a7 = allocator.allocHeap(vm, 108);
        assert.equal(a7, 108);
        allocator.freeHeap(vm, a7);
        const a8 = allocator.allocHeap(vm, 10);
        const a9 = allocator.allocHeap(vm, 10);
        const a10 = allocator.allocHeap(vm, 10);
        allocator.freeHeap(vm, a8);
        allocator.freeHeap(vm, a10);
        allocator.freeHeap(vm, a9);
        const a11 = allocator.allocHeap(vm, 108);
        assert.equal(a11, 108);
    });

    it('fast heap alloc', function () {
        const allocator = new FastHeapAllocator();
        const buffer = new ArrayBuffer(10000);
        const vm = new Runtime({
            heapStart: 0
        });
        vm.memoryBuffer = buffer;
        vm.memory = new DataView(buffer);
        vm.memoryUint8Array = new Uint8Array(buffer);
        vm.sp = 10000;
        vm.heapStart = 100;
        vm.heapPointer = 100;
        allocator.poolSize[0] = 2;
        allocator.poolSize[1] = 2;
        allocator.init(vm);
        const a1 = allocator.allocHeap(vm, 10);
        const a2 = allocator.allocHeap(vm, 30);
        const a3 = allocator.allocHeap(vm, 70);
        const a4 = allocator.allocHeap(vm, 90);
        allocator.freeHeap(vm, a1);
        allocator.freeHeap(vm, a2);
        allocator.freeHeap(vm, a3);
        allocator.freeHeap(vm, a4);
        const a5 = allocator.allocHeap(vm, 10);
        const a6 = allocator.allocHeap(vm, 30);
        const a7 = allocator.allocHeap(vm, 70);
        const a8 = allocator.allocHeap(vm, 90);
        assert.equal(JSON.stringify([a1, a2, a3, a4]), JSON.stringify([a5, a6, a7, a8]));
        const a9 = allocator.allocHeap(vm, 1024);
        allocator.freeHeap(vm, a9);
    })
});