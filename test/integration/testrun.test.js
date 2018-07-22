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

struct A{
    static int bbb;
    static int foo(int a){
        return a + 1;
    }
    int goo(int b){
        printf("%d,", b);
        printf("%d,", this->d);
        printf("%d,", this->d + b);
        return 0;
    }
    int d;
};

int A::bbb;

int main(){
    A::bbb = 3;
    A a;
    a.d = 2;
    //printf("%d", A::foo(2));
    //printf("%d", a.d);
    printf("%d", a.goo(2));
    return 0;
}
`;

describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source3, true, true);
        console.log(result);
    })
});