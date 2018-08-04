
const {CompilerError,ParserError} = require("../../dist/common/error");
const {NoInputFile, StringInputFile, StringOutputFile} = require("../../dist/runtime/vmfile");
const {NativeRuntime} = require("../../dist/runtime/native_runtime");
const {Headers, Impls, JsAPIMap} = require("../../dist/library/index");
const {assert} = require('chai');
const {preprocess} = require('../../dist/preprocessor/index');
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const Linker = require('../../dist/linker');
const fs = require("fs");

function compile(name, source, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code, {fileName: name, isCpp: options.isCpp});
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}

const precompiledObjects = Array.from(Impls.keys()).map(x=>compile(x, Impls.get(x), {isCpp: true}));

async function testRun(source, options){
    if( !options ) options = {};
    let result = [""];
    try {
        const obj = compile('main.cpp', source, options);
        const objs = [...precompiledObjects, obj];
        const bin = Linker.link("main", options.linkStd ? objs : [obj], options);
        const importObj = {system: {}};
        for(const key of Object.keys(JsAPIMap)){
            importObj["system"]["::" + key] = JsAPIMap[key];
        }
        fs.writeFileSync('test.wasm', new Uint8Array(bin.binary));
        const runtime = new NativeRuntime(bin.binary, 10, bin.entry, importObj, [
            new StringInputFile(options.input),
            new StringOutputFile(result),
            new StringOutputFile(result),
        ]);
        await runtime.run();
    } catch (e) {
        if( e instanceof CompilerError){
            console.log(e.location.source);
        }
        if( e instanceof ParserError){
            console.log(e.location.start.line);
        }
        throw e;
    }
    return result[0];
}


async function testRunCompareResult(source, expectOutput, options){
    const actualOutput = await testRun("#include<stdio.h>\nint main(){ " + source + " return 0; }\n", options);
    assert.equal(actualOutput.trim(), expectOutput.trim());
}

async function testFullCode(source, expectOutput, options){
    const actualOutput = await testRun(source, options);
    assert.equal(actualOutput.trim(), expectOutput.trim());
}

module.exports = {
    testRun,
    testRunCompareResult,
    testFullCode,
    compile,
    assert
};