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
                int q= 80;
                printf("%d\\n", q);
            }
            printf("%d\\n", q);
            return 0;
        }
        `;
        const expectOutput = `90\n80\n20`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
});