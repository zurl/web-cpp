const {NoInputFile, StringOutputFile} = require("../../dist/runtime/vmfile");
const {NativeRuntime} = require("../../dist/runtime/native_runtime");
const {fromBytesToString} = require( "../../dist/common/utils");
const CodeGenTestBase = require("../codegen/testbase");
const {VirtualMachine} = require("../../dist/vm/index");
const {Headers, Impls, JsAPIMap} = require("../../dist/library/index");
const {assert} = require('chai');

async function testRun(source, debug){
    let options = {};
    if(debug) options = {debugMode: true};
    let result = [""];
    const obj = CodeGenTestBase.compile('main.cpp', source, options);
    const bin = CodeGenTestBase.components.Linker.link("main", [
        obj
        ], options);
    const importObj = {system: {}};
    for(const key of Object.keys(JsAPIMap)){
        importObj["system"]["::" + key] = JsAPIMap[key];
    }
    const runtime = new NativeRuntime(bin.binary, 10, bin.entry, importObj, [
        new NoInputFile(),
        new StringOutputFile(result),
        new StringOutputFile(result),
    ]);
    await runtime.run();
    return result[0];
}


async function testRunCompareResult(source, expectOutput){
    const actualOutput = await testRun("#include<stdio.h>\nint main(){ " + source + " return 0; }\n", true);
    assert.equal(actualOutput.trim(), expectOutput.trim());
}

module.exports = {
    testRun,
    testRunCompareResult
};