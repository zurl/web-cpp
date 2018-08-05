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

const source4=`
#include <stdio.h>

struct A{
    static int bbb;
    int sb = 24;
    A() :sb(26){
        dump_stack_info();
        printf("CTOR: %d\\n", this->sb);
    }
    A(const A & b){
         printf("CCTOR %d\\n", b.sb);
        this->sb = b.sb;
    }
    A(int b){
        this->sb = b;
        printf("CTOR: %d\\n", this->sb);
    }
    ~A(){
        printf("DTOR %d\\n", this->sb);
    }
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
    A operator+(int c){
        //printf(" opertor + \\n");
        A ret;
        ret.d = this->d + c;
        return ret;
    }
    A& operator=(A & a){
        printf("ACTOR %d\\n", a.sb);
        this->d = a.d;
        this->sb = a.sb;
        return *this;
    }
};

int A::bbb;

A returnAObj(int b){
    A a;
    a.d = b;
    return a;
}
A add1(A b){
    A ret(b);
    dump_stack_info();
    printf("ss");
    printf("b:%d, ret:%d\\n", b.sb, ret.sb);
    ret.sb += 122;
    return ret;
}
int main(){
    //A b = returnAObj(3);
    //A q = b + 5;
    A a(123);
    A b = add1(a);
    printf("%d, %d", a.sb, b.sb);
    dump_stack_info();
    dump_stack_info();
    A w = A();
    dump_stack_info();
    printf("%d", w.sb);
    return 0;
}
`;

const source3 = `
#include "stdio.h"
class A{
    int a;
    A(int b): a(b){}
    virtual void foo(){
        printf("base\\n");
    }
};

class B: public A
{
int a;
};
int main(){
    A a(5), b(0);
    a.foo();
    return 0;
}
`;
describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source3, {isCpp: true, debug: true, linkStd: true});
        console.log(result);
    })
});