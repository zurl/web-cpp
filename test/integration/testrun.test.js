const TestBase = require('./testbase');
const fs = require('fs');

const source = `
int foo(int x){
    print(x);
    return 24;
}
int main(){
    int a = foo(12);
    print(a);
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source);
        console.log(result);
    })
});