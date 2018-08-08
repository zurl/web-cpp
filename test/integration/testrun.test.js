const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>
class A{
    A(){
        printf("A()");
    }
    ~A(){
        printf("~A()");
    }
};
int main(){
    //A * a = new A[10];
    return 0;
}
`;
describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source, {isCpp: true, debug: true, linkStd: true});
        console.log(result);
    })
});