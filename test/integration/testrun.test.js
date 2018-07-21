const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>
struct mystruct{
    int a, b, c;
};
struct mystruct d[10];
int main(){
    int a = 1;
    int &b = 2;
    printf("%d\\n", (*b).a); 
    return 0;
}
`;

const source3=`
#include <stdio.h>

void foo(const int & b){
    b = 3;
}

int main(){
    int a = 1;
    int &b = a;
    int &c = a;
    printf("%d", a);
    foo(a);
    printf("%d", a);
    foo(b);
    printf("%d", a);
    return 0;
}
`;

describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source3, false, true);
        console.log(result);
    })
});