const TestBase = require('./testbase');
const fs = require('fs');

const source = `
int a = 123;
const int dd = 234;
int b = a + 1, c = 3;
double k = 1.99;
const char * uu = "abc";
int main(){
    __jlibc__print_integer(12);
}
`;

describe('test compiler', function(){
    it('test compilers', function(){
        const {code, map} = TestBase.components.Preprocess.process('main.cpp', source);
        const translationUnit = TestBase.components.CParser.parse(code);
        fs.writeFileSync('ast.map', TestBase.printAST(translationUnit));
        const ctx = new TestBase.components.CompileContext('main.cpp', {debugMode: true}, TestBase.HeaderScopeMap);
        TestBase.components.codegen(translationUnit, ctx);
        const obj = ctx.toCompiledObject();
        const bin = TestBase.components.Linker.link([obj], TestBase.JsAPIMap, {debugMode: true});
        TestBase.components.InstructionBuilder.showCode(bin.code, {
            withLabel: true,
            withAddress: true,
            withSourceMap: true,
            friendlyJMP: true,
            sourceMap: bin.sourceMap,
            dataStart: bin.dataStart,
            dataMap: bin.dataMap,
            source: {
                'main.cpp': source.split('\n')
            }
        });
    })
});
