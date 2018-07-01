const TestBase = require('./testbase');
const fs = require('fs');

const source = `
int main(){
    int arr[120], b;
    arr[0] = 1;
    *arr = 1;
    *(arr + 1) = 1;
    b = arr[0];
    return 0;
}
`;

describe('test compiler', function(){
    it('test compilers', function(){
        const {code, map} = TestBase.components.Preprocess.process('main.cpp', source);
        const translationUnit = TestBase.components.CParser.parse(code);
        fs.writeFileSync('ast.map', TestBase.printAST(translationUnit));
        const ctx = new TestBase.components.CompileContext('main.cpp', {debugMode: true});
        TestBase.components.codegen(translationUnit, ctx);
        const obj = ctx.toCompiledObject();
        const bin = TestBase.components.Linker.link([obj], {debugMode: true});
        TestBase.components.InstructionBuilder.showCode(bin.code, {
            withLabel: true,
            withAddress: true,
            withSourceMap: true,
            friendlyJMP: true,
            sourceMap: bin.sourceMap,
            source: {
                'main.cpp': source.split('\n')
            }
        });
    })
});
