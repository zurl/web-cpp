const TestBase = require('./testbase');
const fs = require('fs');

const old_source = `

struct a1;

typedef struct aa{
    int a;
} uu;


struct b1{
int c;
int e;
char q;
} p0, p1, p2;



struct TestStruct{
    int a;
    //TestStruct * a;
    struct TestStruct * accc;
};
int main(){
    static int d;
    p0.c = 1;
    p0.q = 3;
    int i = 0;
    while( i < 10 ){
        if( i < 5) continue;
        break;
    }
    __jlibc__print_integer(sizeof(struct TestStruct));
}
`;

const source = `
typedef void* va_list;
#define va_start(ptr, arg) (ptr) = &(arg) + sizeof(arg) + 4
#define va_arg(ptr, type) ((ptr)+=sizeof(type), *((type *)(ptr - sizeof(type))))

void printf(const char * format, ...){
    va_list ptr;
    va_start(ptr, format);
    int c = *(int *) ptr;
}

int main(){
    
    va_list a = "123";
    //printf("aaa", 123, 477);
}
`;

describe('test compiler', function(){
    it('test compilers', function(){
        const {code, map} = TestBase.components.preprocess('main.cpp', source);
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
        console.log("==ScopeMap==");
        console.log(TestBase.dumpScopeMap(bin.scopeMap));
    })
});
