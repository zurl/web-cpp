const {NoInputFile, StringOutputFile} = require("../../dist/runtime/vmfile");
const {NativeRuntime} = require("../../dist/runtime/native_runtime");
const {Headers, Impls, JsAPIMap} = require("../../dist/library/index");
const {assert} = require('chai');
const {preprocess} = require('../../dist/preprocessor/index');
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const Linker = require('../../dist/linker');

function compile(name, source, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code, {fileName: name});
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}
async function testRun(source, debug, isCpp){
    let options = { isCpp, debug };
    let result = [""];
    const obj = compile('main.cpp', source, options);
    const bin = Linker.link("main", [
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


async function testRunCompareResult(source, expectOutput, isCpp = false){
    const actualOutput = await testRun("#include<stdio.h>\nint main(){ " + source + " return 0; }\n", true, isCpp);
    assert.equal(actualOutput.trim(), expectOutput.trim());
}

async function testFullCode(source, expectOutput, isCpp = false){
    const actualOutput = await testRun(source, true, isCpp);
    assert.equal(actualOutput.trim(), expectOutput.trim());
}

module.exports = {
    testRun,
    testRunCompareResult,
    testFullCode,
    compile
};