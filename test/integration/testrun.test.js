const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>

int main(){
    char a0 = 1;
        unsigned char a1 = 1;
        short a2 = 1;
        unsigned short a3 = 1;
        int a4 = 1;
        unsigned int a5 = 1;
        float a6 = 1;
        double a7 = 1;
        printf("%d%d%d%d%d%d%.3f,",a0,a1,a2,a3,a4,a5,a7);
        printf("%.3f", a6);
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source, true);
        console.log(result);
    })
});