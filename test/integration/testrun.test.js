const TestBase = require('./testbase');
const fs = require('fs');

const source = `
typedef void* va_list;
#define va_start(ptr, arg) (ptr) = &(arg) + sizeof(arg) + 4
#define va_arg(ptr, type) ((ptr) += sizeof(type), *((type *)(ptr - sizeof(type))))
#define va_end(ptr) (ptr) = 0;

int printf(const char * format, ...){
    va_list ptr;
    va_start(ptr, format);
    int a = va_arg(ptr, int);
    int b = va_arg(ptr, int);
    int c = va_arg(ptr, int);
    print(a);
    print(b);
    print(c);
    return 0;
}

int main(){
    va_list a = "123";
    printf("aaa", 123, 477, 999);
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source, true);
        console.log(result);
    })
});