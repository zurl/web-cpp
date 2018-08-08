const TestBase = require('./testbase');
describe('class integration test', function () {
    it('testStruct',async function() {
        const testCode = `
#include <stdio.h>
        struct A{
            int a;
            int b;
            int c;
        } a;
        int main(){
            struct A b;
            a.a = 1;
            a.b = 2;
            a.c = a.a + a.b;
            printf("%d", a.c);
            b.b = 2;
            printf("%d", b.b);
            return 0;
        }
        `;
        const expectOutput = `32`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test union',async function() {
        const testCode = `
#include <stdio.h>
        union A{
            int a;
            int b;
            int c;
        } a;
        int main(){
            union A b;
            a.a = 1;
            a.b = 2;
            a.c = a.a + a.b;
            printf("%d", a.c);
            b.b = 2;
            printf("%d", b.b);
            return 0;
        }
        `;
        const expectOutput = `42`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test enum',async function() {
        const testCode = `
#include <stdio.h>
        enum A{
            a, b, c, d = 20
        };
        int main(){
            printf("%d,%d,%d,%d,", a, b, c, d);
            enum A u = a;
            printf("%d", u);
            return 0;
        }
        `;
        const expectOutput = `0,1,2,20,0`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test struct 2', async function() {
        const testCode = `
#include <stdio.h>
        struct mystruct{
            int a, b, c;
        };
        struct mystruct d[10];
        int main(){
        struct mystruct u[10];
            int a[100];
            struct mystruct * b = u+7;
            (*b).a=14;
            printf("%d\\n", (*b).a); 
            return 0;
        }`;
        const expectOutput = `14`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test class cpp', async function() {
        const testCode = `
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
            printf("%d,", A::foo(2));
            printf("%d,", a.d);
            printf("%d,", a.goo(2));
            return 0;
        }`;
        const expectOutput = `3,2,2,2,4,0,`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test ctor & assign ctor', async function() {
        const testCode = `
#include <stdio.h>
        
        struct A{
            static int bbb;
            int sb = 24;
            A() :sb(26){
                printf("ctor: %d\\n", this->sb);
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
                printf("opertor + \\n");
                A ret;
                ret.d = this->d + c;
                return ret;
            }
            A& operator=(A & a){
                printf("assign ctor\\n");
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
            A b = returnAObj(3);
            A q = b + 5;
            A w = A();
            printf("%d", w.sb);
            return 0;
        }`;
        const expectOutput = `ctor: 26
dtor
assign ctor
opertor + 
ctor: 26
dtor
assign ctor
ctor: 26
assign ctor
26dtor
dtor
dtor
dtor`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });

    it('test inheritance',async function() {
        const testCode = `
#include "stdio.h"
        class A{
            int a;
            A(int a): a(a){}
            virtual void foo(){
                printf("base\\n");
            }
            ~A() {
                printf("~A(%d)\\n", a);
            }
        };
        
        class B: public A
        {
        int d;
        B(int a, int b): A(a), d(b){}
         ~B() {
                printf("~B(%d)\\n", d);
            }
        };
        int main(){
            B a(5, 7), b(0, 3);
            a.foo();
            B *c = new B(1, 2);
            B *d = new B(1, 2);
            delete c;
            delete d;
            return 0;
        }
        `;
        const expectOutput = `base\n~B(2)\n~A(1)\n~B(2)\n~A(1)\n~B(7)\n~A(5)\n~B(3)\n~A(0)`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
});