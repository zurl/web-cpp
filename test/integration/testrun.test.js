const TestBase = require('./testbase');
const fs = require('fs');

const source = `
int foo(int x){
    print(x);
    return 24;
}
int main(){
    char mystring[10];
    int a = foo(12);
    print(a);
    puts("hello world!\\n");
    mystring[0] = 'a';
    mystring[1] = 'c';
    mystring[2] = 48;
    mystring[3] = 0;
    puts(mystring);
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source, true);
        console.log(result);
    })
});