const {JSRuntime} = require("../../dist/runtime/js_runtime");
const {SourceMapConsumer} = require("source-map");
const {RuntimeError, CompilerError} = require("../../dist/common/error");
const {NoInputFile, CommandOutputFile, StringInputFile, StringOutputFile} = require("../../dist/runtime/vmfile");
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
    options.fileName = name;
    const {code, map} = preprocess(name, source);
    try {
        const translationUnit = CParser.parse(code, options);
        const ctx = new CompileContext(name, options, source, map);
        codegen(translationUnit, ctx);
        return ctx.toCompiledObject();
    } catch (e) {
        const sm = new SourceMapConsumer(map.toString());
        if (e instanceof CompilerError) {
            const newStart = sm.originalPositionFor(e.location.start);
            e.errorLine = source.split("\n")[newStart.line];
            e.location.start.line = newStart.line;
            e.location.start.column = newStart.column;
        }
        console.log(e);
        throw e;
    }
}

const precompiledObjects = Array.from(Impls.keys()).map(x=>compile(x, Impls.get(x), {isCpp: true}));

async function testRun(source, options) {
    const ret1 = await testNativeRun(source, options);
    const ret2 = await testJsRun(source, options);
    if(ret1 !== ret2){
        console.log("====native====");
        console.log(ret1);
        console.log("====js====");
        console.log(ret2);
        throw new RuntimeError(`behavior of native and js is inconsistent`);
    }
    return ret1;
}

async function testJsRun(source, options){
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
        const runtime = new JSRuntime({
            importObjects: importObj,
            program: bin.json,
            memorySize: 10 * 65536,
            entryFileName: 'main.cpp',
            entry: bin.entry,
            heapStart: bin.heapStart,
            scope: bin.scope,
            files: [
                new StringInputFile(options.input),
                new StringOutputFile(result),
                new StringOutputFile(result),
            ],
        });
        await runtime.run();
    } catch (e) {
        if( e instanceof CompilerError){
            console.log(e.errorLine);
        }
        throw e;
    }
    return result[0];
}

async function testNativeRun(source, options){
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
        const runtime = new NativeRuntime({
            importObjects: importObj,
            code: bin.binary,
            memorySize: 10 * 65536,
            entry: bin.entry,
            heapStart: bin.heapStart,
            files: [
                new StringInputFile(options.input),
                new StringOutputFile(result),
                new StringOutputFile(result),
            ],
        });
        await runtime.run();
    } catch (e) {
        if( e instanceof CompilerError){
            console.log(e.errorLine);
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