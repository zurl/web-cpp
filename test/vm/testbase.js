
const {InstructionBuilder} = require("../../dist/common/instruction");
const {VirtualMachine}= require("../../dist/vm");
const Assert = require('chai');

/**
 * Test a piece of asm code
 * @param source
 * @param { { pc?: number, sp?:number, stop_u32?:number, stop_i32?:number, mem_i32?: {addr:number, val:number} | [{addr:number, val:number}],mem_u32?: {addr:number, val:number} | [{addr:number, val:number}]} } asserts
 */
function testASMCode(source, asserts){
    if( source instanceof Array){
        source = source.join('\n');
    }
    const ib = new InstructionBuilder(1000);
    ib.fromText(source + "\nEND\n");
    const asm = ib.toAssembly();
    const vm = new VirtualMachine({
        memory: asm.code,
        heapStart: asm.size,
        files: [],
    });
    while( vm.runOneStep() );
    if(asserts.hasOwnProperty('pc')){
        Assert.assert.equal(vm.pc, asserts.pc, 'pc');
    }
    if(asserts.hasOwnProperty('sp')){
        Assert.assert.equal(vm.sp - 1000, asserts.sp, 'sp');
    }
    if(asserts.hasOwnProperty('bp')){
        Assert.assert.equal(vm.bp - 1000, asserts.bp, 'bp');
    }
    if(asserts.hasOwnProperty('stop_u32')){
        Assert.assert.equal(vm.memory.getUint32(vm.sp), asserts.stop_u32, 'stop_u32');
    }
    if(asserts.hasOwnProperty('stop_i32')){
        Assert.assert.equal(vm.memory.getInt32(vm.sp), asserts.stop_i32, 'stop_i32');
    }
    if(asserts.hasOwnProperty('stop_f32')){
        Assert.assert.equal(Math.abs(vm.memory.getFloat32(vm.sp) - asserts.stop_f32) < 1e-3, true, 'stop_f32');
    }
    if(asserts.hasOwnProperty('stop_f64')){
        Assert.assert.equal(Math.abs(vm.memory.getFloat64(vm.sp) - asserts.stop_f64) < 1e-3, true, 'stop_f64');
    }
    if(asserts.hasOwnProperty('mem_u32')){
        if( !(asserts.mem_u32 instanceof Array)) asserts.mem_u32 = [asserts.mem_u32];
        asserts.mem_u32.map( mem => Assert.assert.equal(vm.memory.getUint32(mem.addr), mem.val, 'mem_u32'));
    }
    if(asserts.hasOwnProperty('mem_i32')){
        if( !(asserts.mem_i32 instanceof Array)) asserts.mem_u32 = [asserts.mem_i32];
        asserts.mem_u32.map( mem => Assert.assert.equal(vm.memory.getInt32(mem.addr), mem.val, 'mem_i32'));
    }
}

module.exports = {
    testASMCode,
    components:{
        InstructionBuilder,
        VirtualMachine
    }
};