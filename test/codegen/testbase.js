const {mergeScopeMap} = require("../../dist/codegen/scope");
const {Headers, Impls, JsAPIMap} = require("../../dist/library/index");
const {preprocess} = require('../../dist/preprocessor/index');
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const {InstructionBuilder} = require('../../dist/common/instruction');
const Linker = require('../../dist/linker');
const Assert = require('chai');
const {Node, SourceLocation} = require("../../dist/common/ast");
const {dumpScopeMap} = require("../../dist/codegen/scope");

function compile(name, source, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code);
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}

function precompileLibrarys() {
    const objects = [];
    for(let impl of Impls.keys()){
        const obj = compile(impl, Impls.get(impl), {debugMode: true});
        objects.push(obj);
    }
    return objects;
}

const LibraryObjects = precompileLibrarys();

function generateAsm(testCode) {
    const obj = compile("test.cpp", testCode);
    const ib = new InstructionBuilder();
    const bin = Linker.link([obj], {}, {});
    ib.codeView = bin.code;
    ib.now = bin.code.buffer.byteLength;
    ib.labels = bin.labelMap;
    return ib.toString();
}

function testCode(testCode, expectCode) {
    const actualCode = generateAsm("int main(){ " + testCode + " }\n");
    const actualPlainCode = actualCode.trim().split('\n').slice(2).map(x => x.trim()).join('\n');
    const expectPlainCode = expectCode.trim().split('\n').map(x => x.trim()).join('\n');
    Assert.assert.equal(actualPlainCode, expectPlainCode);
}

function testFullCode(testCode, expectCode) {
    const actualCode = generateAsm(testCode + "\n");
    const actualPlainCode = actualCode.trim().split('\n').slice(2).map(x => x.trim()).join('\n');
    const expectPlainCode = expectCode.trim().split('\n').map(x => x.trim()).join('\n');
    Assert.assert.equal(actualPlainCode, expectPlainCode);
}

function print(str, indent){
    let space = "";
    for(let i = 0; i < indent; i++) space += " ";
    return space + str + "\n";
}

function printAST(node, indent = 0, nameIndent = 0) {
    let result = "";
    let nameSpace = "";
    for (let i = 0; i < nameIndent; i++) nameSpace += " ";
    if (node instanceof SourceLocation) {
        result += `${node.start}=>${node.end}\n`;
    }
    else if (node instanceof Array) {
        if (node.length == 0) {
            result = "[]\n";
        }
        else {
            result += "[\n";
            for (let item of node) {
                result += printAST(item, indent, indent)
            }
            result += print("]", indent);
        }
    }
    else if (node instanceof Node) {
        let space = "";
        for (let i = 0; i < indent; i++) space += " ";

        result += nameSpace + node.constructor.name + '{\n';
        for (let member of Object.keys(node)) {
            if (member === "parentNode" || member == "location") continue;
            result += space + member + ": ";
            result += printAST(node[member], indent + 4, 0)
        }
        result += print('}', indent);
    }
    else {
        if (node != null) result = nameSpace + node.toString() + "\n";
        else result = "\n";
    }
    return result;
}

function showASM(metaInfo, bin){
    InstructionBuilder.showCode(bin.code, {
        withLabel: true,
        withAddress: true,
        withSourceMap: true,
        friendlyJMP: true,
        sourceMap: bin.sourceMap,
        dataStart: bin.dataStart,
        dataMap: bin.dataMap,
        metaInfo
    });
}

module.exports = {
    generateAsm,
    testCode,
    testFullCode,
    components:{
        preprocess,
        CParser,
        codegen,
        CompileContext,
        InstructionBuilder,
        Linker
    },
    compile,
    printAST,
    JsAPIMap,
    Headers,
    mergeScopeMap,
    showASM,
    dumpScopeMap,
    LibraryObjects
};