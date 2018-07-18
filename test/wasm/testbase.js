const {preprocess} = require('../../dist/preprocessor/index');
const {CParser} = require('../../dist/parser');
const {codegen} = require('../../dist/codegen/index');
const {CompileContext} = require('../../dist/codegen/context');
const Linker = require('../../dist/linker');

const {compile} = require("../codegen/testbase");


module.exports = {
    compile,
    Linker
};