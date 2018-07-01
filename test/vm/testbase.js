
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
    const vm = new VirtualMachine(asm.code);
    while( vm.runOneStep() );
    if(asserts.hasOwnProperty('pc')){
        Assert.assert.equal(vm.pc, asserts.pc);
    }
    if(asserts.hasOwnProperty('sp')){
        Assert.assert.equal(vm.sp - vm.bp, asserts.sp);
    }
    if(asserts.hasOwnProperty('stop_u32')){
        Assert.assert.equal(vm.memory.getUint32(vm.sp), asserts.stop_u32);
    }
    if(asserts.hasOwnProperty('stop_i32')){
        Assert.assert.equal(vm.memory.getInt32(vm.sp), asserts.stop_i32);
    }
    if(asserts.hasOwnProperty('stop_f64')){
        Assert.assert.equal(vm.memory.getFloat64(vm.sp), asserts.stop_f64);
    }
    if(asserts.hasOwnProperty('mem_u32')){
        if( !(asserts.mem_u32 instanceof Array)) asserts.mem_u32 = [asserts.mem_u32];
        asserts.mem_u32.map( mem => Assert.assert.equal(vm.memory.getUint32(mem.addr), mem.val));
    }
    if(asserts.hasOwnProperty('mem_i32')){
        if( !(asserts.mem_i32 instanceof Array)) asserts.mem_u32 = [asserts.mem_i32];
        asserts.mem_u32.map( mem => Assert.assert.equal(vm.memory.getInt32(mem.addr), mem.val));
    }
}

module.exports = {
    testASMCode,
    components:{
        InstructionBuilder,
        VirtualMachine
    }
};