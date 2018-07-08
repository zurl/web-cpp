const {fromBytesToString} = require( "../../dist/common/utils");
const CodeGenTestBase = require("../codegen/testbase");
const {VirtualMachine} = require("../../dist/vm/index");
const {Headers, Impls, JsAPIMap} = require("../../dist/library/index");
const Assert = require('chai');

function testRun(source, debug){
    let options = {};
    if(debug) options = {debugMode: true};
    let result = "";
    const print = (vm) => {
        result += vm.popInt32() + "\n";
    };
    const puts = (vm) =>{
        result += fromBytesToString(vm.memory, vm.popUint32()) + "\n";
    };
    const obj = CodeGenTestBase.compile('main.cpp', source, options);
    const bin = CodeGenTestBase.components.Linker.link([
        obj,
        ...CodeGenTestBase.LibraryObjects
        ],
        {
            ...CodeGenTestBase.JsAPIMap,
            print,
            puts
        }, options);
    if(debug) {
        CodeGenTestBase.showASM(bin.metaInfo, bin);
    }
    const memoryBuffer = new ArrayBuffer(10000);
    const memory = new DataView(memoryBuffer);
    const memoryArray = new Uint8Array(memoryBuffer);
    memoryArray.set(new Uint8Array(bin.code.buffer), 0);
    const vm = new VirtualMachine({
        memory,
        heapStart: bin.code.buffer.byteLength,
        jsAPIList: bin.jsAPIList,
    });
    let i = 0;
    while( i < 100000 ){
        const ret = vm.runOneStep();
        if(!ret) return result;
    }
    throw "code run too much";
}


function testRunCompareResult(source, expectOutput){
    const actualOutput = testRun("#include<syscall.h>\nint main(){ " + source + " return 0; }\n");
    const actualPlainOutput = actualOutput.trim().split('\n').slice(2).map(x => x.trim()).join('\n');
    const expectPlainOutput = expectOutput.trim().split('\n').slice(2).map(x => x.trim()).join('\n');
    Assert.assert.equal(actualPlainOutput, expectPlainOutput);
}

module.exports = {
    testRun,
    testRunCompareResult
};