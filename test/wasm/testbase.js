const {preprocess} = require('../../dist/preprocessor/index');
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const Linker = require('../../dist/linker');

function compile(name, source, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code);
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}


module.exports = {
    compile,
    Linker
};