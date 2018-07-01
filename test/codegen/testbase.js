const Preprocess = require('../../dist/preprocessor').default;
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const {InstructionBuilder} = require('../../dist/common/instruction');
const Linker = require('../../dist/linker');
const Assert = require('chai');
const {Node, SourceLocation} = require("../../dist/common/ast");

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

module.exports = {
    generateAsm,
    testCode,
    components:{
        Preprocess,
        CParser,
        codegen,
        CompileContext,
        InstructionBuilder,
        Linker
    },
    printAST
};