const Preprocess = require('../../dist/preprocessor').default;
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const {InstructionBuilder} = require('../../dist/common/instruction');
const Linker = require('../../dist/linker');
const Assert = require('chai');

function compile(name, source) {
    const {code, map} = Preprocess.process(name, source);
    const translationUnit = CParser.parse(code);
    const ctx = new CompileContext(name, {});
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}

function generateAsm(testCode) {
    const obj = compile("test.cpp", testCode);
    const ib = new InstructionBuilder();
    const bin = Linker.link([obj]);
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

module.exports = {
    generateAsm,
    testCode
};