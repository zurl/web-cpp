const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>
class A{
public:
    A(){
        printf("A()\\n");
    }
    virtual ~A(){
        printf("~A()\\n");
    }
    virtual void foo(){
        printf("A::foo()\\n");
    }
};
class B: public A{
public:
    void foo(){
         printf("B::foo()\\n");
    }
    ~B(){
        printf("~B()\\n");
    }
};
int main(){
    //int size = 10;
    A * a = new A();
    A * b = new B();
    A & ar = *a;
    A & br = *b;
    a->foo();
    b->foo();
    ar.foo();
    br.foo();
    delete a;
    delete b;
    return 0;
}
`;

describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source, {isCpp: true, debug: true});
        console.log(result);
    })
});