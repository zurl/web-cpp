const TestBase = require('./testbase');
describe('calculation integration test', function () {
    it('int +-*/%',async function() {
        const testCode = `
        int a = 1;
        int b = 2;
        printf("%d", a+b);
        printf("%d", a-b);
        printf("%d", a*b);
        printf("%d", a/b);
        printf("%d", a%b);
        `;
        const expectOutput = `3-1201`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('float +-*/',async function() {
        const testCode = `
        float a = 1.0f;
        float b = 2.0f;
        printf("%lf", a+b);
        printf("%lf", a-b);
        printf("%lf", a*b);
        printf("%lf", a/b);
        `;
        const expectOutput = `3-120.5`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('int +=',async function() {
        const testCode = `
        int a = 1;
        int b = 2;
        printf("%d", a+=b);
        printf("%d", a-=b);
        printf("%d", a*=b);
        printf("%d", a/=b);
        printf("%d", a%=b);
        `;
        const expectOutput = `31211`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('conditional expr' ,async function() {
        const testCode = `
#include <stdio.h>

        struct A{
            int d;
            A(int c):d(c){}
        };
        
        int main(){
            int a = 5;
            int b = 6;
            int c = 8;
            int d = (a == 5) ? b : c;
            int e = (a == 12) ? b : c;
            printf("%d,%d,", d, e);
            A a0(2), a1(3);
            printf("%d,%d,", a0.d, a1.d);
            A a3 = (a == 5) ? a0 : a1;
            A a4 = (a == 12) ? a0 : a1;
            printf("%d,%d,", a3.d, a4.d);
            return 0;
        }
        `;
        const expectOutput = `6,8,2,3,2,3,`;
        return await TestBase.testFullCode(testCode, expectOutput, true);
    });
});