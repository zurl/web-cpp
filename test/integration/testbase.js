const {NoInputFile, StringOutputFile} = require("../../dist/vm/vmfile");
const {fromBytesToString} = require( "../../dist/common/utils");
const CodeGenTestBase = require("../codegen/testbase");
const {VirtualMachine} = require("../../dist/vm/index");
const {Headers, Impls, JsAPIMap} = require("../../dist/library/index");
const {assert} = require('chai');

function testRun(source, debug){
    let options = {};
    if(debug) options = {debugMode: true};
    let result = [""];
    const obj = CodeGenTestBase.compile('main.cpp', source, options);
    const bin = CodeGenTestBase.components.Linker.link([
        obj,
        ...CodeGenTestBase.LibraryObjects
        ],CodeGenTestBase.JsAPIMap, options);
    if(debug) {
        CodeGenTestBase.showASM(bin.metaInfo, bin);
    }
    const memoryBuffer = new ArrayBuffer(10000);
    const memory = new DataView(memoryBuffer);
    const memoryArray = new Uint8Array(memoryBuffer);
    memoryArray.set(new Uint8Array(bin.code.buffer), 0);
    const vm = new VirtualMachine({
        memory,
        heapStart: bin.code.buffer.byteLength + bin.bssSize,
        jsAPIList: bin.jsAPIList,
        files: [
            new NoInputFile(),
            new StringOutputFile(result),
            new StringOutputFile(result),
        ],
    });
    vm.simpleRun();
    return result[0];
}


function testRunCompareResult(source, expectOutput){
    const actualOutput = testRun("#include<stdio.h>\nint main(){ " + source + " return 0; }\n", true);
    assert.equal(actualOutput.trim(), expectOutput.trim());
}

module.exports = {
    testRun,
    testRunCompareResult
};