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
        return await TestBase.testFullCode(testCode, expectOutput, true, true);
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
        return await TestBase.testFullCode(testCode, expectOutput, true);
    });

});