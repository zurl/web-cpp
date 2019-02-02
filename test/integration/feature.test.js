const TestBase = require('./testbase');
describe('feature integration test', function () {
    it('test inner scope', async function () {
        const testCode = `
#include <stdio.h>
        int main(){
            int a = 0;
            for(int i = 1; i <10; i++) a+=i;
            for(int i = 1; i <10; i++) a+=i;
            printf("%d\\n", a);
            int q = 20;
            {
                int q = 80;
                printf("%d\\n", q);
            }
            printf("%d\\n", q);
            return 0;
        }
        `;
        const expectOutput = `90\n80\n20`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test function pointer', async function () {
        const testCode = `
#include <stdio.h>
        int foo(int a){
            return a + 1;
        }
        int goo(int b){
            return b + 12;
        }
        int main(){
            int (*p1)(int);
            int (*p2)(int);
            p1 = foo;
            p2 = goo;
            printf("%d,%d", p1(1), p2(1));
            return 0;
        }
        `;
        const expectOutput = `2,13`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test multi-dim-array', async function () {
        const testCode = `
#include <stdio.h>
        int a[12][13];

        int main(){
            for(int i = 0; i < 8; i++){
                for(int j = 0; j < 8; j++){
                    a[i][j] = i + j;
                }
            }
            for(int i = 0; i < 8; i++){
                for(int j = 0; j < 8; j++){
                    printf("%d,", a[i][j]);
                }
                printf("\\n");
            }
            return 0;
        }
        `;
        const expectOutput = `0,1,2,3,4,5,6,7,
1,2,3,4,5,6,7,8,
2,3,4,5,6,7,8,9,
3,4,5,6,7,8,9,10,
4,5,6,7,8,9,10,11,
5,6,7,8,9,10,11,12,
6,7,8,9,10,11,12,13,
7,8,9,10,11,12,13,14,`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test scanf',async function() {
        const testCode = `
        int a;
        int b;
        char buffer[1024];
        scanf("%d %d %s", &a, &b, buffer);
        printf("%d %d %s", a, b, buffer);
        `;
        const expectOutput = `999 888 hahaha`;
        return await TestBase.testRunCompareResult(testCode, expectOutput, {
            input: "999 888 hahaha"
        });
    });
    it('test getchar',async function() {
        const testCode = `
        int a = getchar();
        int b = getchar();
        printf("%d %d", a, b);
        `;
        const expectOutput = `48 -1`;
        return await TestBase.testRunCompareResult(testCode, expectOutput, {
            input: "0"
        });
    });
    it('test implicit this', async function () {
        const testCode = `
#include "stdio.h"
        class A{
            int a;
            A(int b): a(b){}
            bool operator<(const A & t){
                return a < t.a;
            }
            bool operator!(){
                return !a;
            }
        };
        int main(){
            A a(5), b(0);
            if( a < b ){
                printf("111\\n");
            } else {
                 printf("222\\n");
            }
            printf("%d %d\\n", !a, !b);
            return 0;
        }
        `;
        const expectOutput = `222\n0 1\n`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test namespace / using', async function () {
        const testCode = `
#include "stdio.h"
        using HAHA = int;
        namespace ABC{
            int main(){
                HAHA b = 3;
                printf("%d", b);
                return 0;
            }
            int a(){
                printf("foo\\n");
                return 0;
            }
        }
        class DDD{
        public:
            static int goo(){
                printf("goo()\\n");
                return 0;
            }
        };
        using DDD::goo;
        int main(){
            using namespace ABC;
            a();
            goo();
            return ABC::main();
        }
        `;
        const expectOutput = `foo\ngoo()\n3`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('multi string literal', async function () {
        const testCode = `
#include "stdio.h"
        int main(){
            printf("1234" "1234" "1234");
            return 0;
        }
        `;
        const expectOutput = `123412341234`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test new delete array', async function () {
        const testCode = `
#include <stdio.h>
        class A{
            A(){
                printf("A()\\n");
            }
            ~A(){
                printf("~A()\\n");
            }
        };
        int main(){
            int size = 3;
            A * a = new A[size];
            delete[] a;
            int *b = new int[20];
            delete[] b;
            int *d = new int[20];
            delete[] d;
            return 0;
        }
        `;
        const expectOutput = `A()\nA()\nA()\n~A()\n~A()\n~A()`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test convert',async function() {
        const testCode = `
        int a = 1;
        int b = 2;
        printf("%f", (float)(a+b));
        float c = 1;
        float d = 2;
        printf("%d", (int)(c+d));
        `;
        const expectOutput = `33`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    /*
    it('const left value reference', async function () {
        const testCode = `
#include <stdio.h>
        int foo(const int & a){

        }
        int main(){
            int a = 0;
            for(int i = 1; i <10; i++) a+=i;
            for(int i = 1; i <10; i++) a+=i;
            printf("%d\\n", a);
            int q = 20;
            {
                int q = 80;
                printf("%d\\n", q);
            }
            printf("%d\\n", q);
            return 0;
        }
        `;
        const expectOutput = `90\n80\n20`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test some new overload', async function () {
        const testCode = `
#include <stdio.h>
        class Foo{
            operator[] (int a){
                return a;
            }
        };
        int main(){
            int a = 0;
            for(int i = 1; i <10; i++) a+=i;
            for(int i = 1; i <10; i++) a+=i;
            printf("%d\\n", a);
            int q = 20;
            {
                int q = 80;
                printf("%d\\n", q);
            }
            printf("%d\\n", q);
            return 0;
        }
        `;
        const expectOutput = `90\n80\n20`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    */
});