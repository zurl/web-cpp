const TestBase = require('./testbase');
describe('function integration test', function () {
    it('test function', async function () {
        const testCode = `
#include <stdio.h>
        int add(int a, int b){
            return a + b;
        }
        int pow(int x, int n){
            int result = 1;
            for(int i = 0; i < n; i++){
                result = result * x;
            }
            return result;
        }
        int main(){
            int c = 10;
            int d = 3;
            int f = 2;
            int result = pow(add(c, d), f);
            printf("%d", result);
            return 0;
        }
        `;
        const expectOutput = `169`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test recursive', async function () {
        const testCode = `
#include <stdio.h>
        int gcd(int a, int b){
            if( b == 0 ) return a;
            else return gcd(b, a%b);
            //return b == 0 ? a : gcd(b, a % b);
        }
        int main(){
            printf("%d,", gcd(128, 256));
            printf("%d,", gcd(7, 199));
            printf("%d,", gcd(32, 4));
            printf("%d,", gcd(9, 7));
            return 0;
        }
        `;
        const expectOutput = `128,1,4,1,`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test overload', async function () {
        const testCode = `
#include <stdio.h>
        int foo(int a){
            printf("1");
            return 0;
        }
        int foo(int a, int b){
            printf("2");
            return 0;
        }
        int foo(char a){
            printf("3");
            return 0;
        }
        int main(){
            char a = 2;
            short b = 3;
            foo(1);
            foo(a);
            foo(a, a);
            foo(b, b);
            return 0;
        }
        `;
        const expectOutput = `1322`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
});