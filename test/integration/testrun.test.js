const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>

int main(){
    int a = 1;
    int b = a++;
    a = 1;
    int c = ++a;
    printf("b=%d, c=%d", b, c);
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source, true);
        console.log(result);
    })
});