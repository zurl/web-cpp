const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>

int main(){
    int a = 2;
    switch(a){
        case 1: printf("1");
        case 2: printf("2");
        case 3: printf("3");
    }
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source, true);
        console.log(result);
    })
});