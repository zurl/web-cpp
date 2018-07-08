const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <syscall.h>
#include <stdio.h>
#include <stdarg.h>

//__libcall void print(int x);
//#define va_start(ptr, arg) (ptr) = &(arg) + sizeof(arg) + 4

int printf(const char * format, ...){
    va_list arg_list;
    va_start(arg_list, format);
    //(arg_list) = &(format) + sizeof(format) + 4;
    int d = *(int *)arg_list;
    print(d);
    return 123;
}

int main(){
    int d = 17;
    d += 13;
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