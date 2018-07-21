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
    it('test enum',async function() {
        const testCode = `
#include <stdio.h>
        enum A{
            a, b, c, d = 20
        };
        int main(){
            printf("%d%d%d%d", a,b,c,d);
            enum A u = a;
            printf("%d", u);
            return 0;
        }
        `;
        const expectOutput = `012200`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
});