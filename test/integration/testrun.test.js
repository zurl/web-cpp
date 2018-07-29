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
    int sb = 24;
    A() :sb(26){
        dump_stack_info();
        printf("ctor: %d\\n", this->sb);
    }
    A(int b){
        this->sb = b;
    }
    ~A(){
        printf("dtor\\n");
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
        printf(" opertor + \\n");
        A ret;
        ret.d = this->d + c;
        return ret;
    }
    A& operator=(A & a){
        printf(" assign ctor\\n");
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

int main(){
    //A b = returnAObj(3);
    //A q = b + 5;
    A a(123);
    printf("%d", a.sb);
    dump_stack_info();
    dump_stack_info();
    A w = A();
    dump_stack_info();
    printf("%d", w.sb);
    return 0;
}
`;

describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source3, true, true);
        console.log(result);
    })
});