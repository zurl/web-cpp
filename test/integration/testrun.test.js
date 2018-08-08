const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>
class A{
    A(){
        printf("A()\\n");
    }
    ~A(){
        printf("~A()\\n");
    }
};
int main(){
    int size = 10;
    A * a = new A[size];
    delete[] a;
    return 0;
}
`;
describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source, {isCpp: true, debug: true, linkStd: true});
        console.log(result);
    })
});