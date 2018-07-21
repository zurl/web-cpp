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
});