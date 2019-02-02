const TestBase = require('../integration/testbase');
describe('stdio', function () {
    it('test printf',async function() {
        const testCode = `
#include <math.h>
#include <stdio.h>
int main(){
    int a = 9;
    long long b = -12;
    float c = 3.5f;
    double d = -7.128;
    printf("%d %ld %0.3f %0.3lf", a, b, c, d);
    return 0;
}
        `;
        const expectOutput = `9 -12 3.5 -7.128`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true,
            debug: true,
            input: "9 -12 3.35 -7.128"});
    });
    it('test scanf',async function() {
        const testCode = `
#include <math.h>
#include <stdio.h>
int main(){
    int a;
    long long b;
    float c;
    double d;
    scanf("%d %ld %f %lf", &a, &b, &c, &d);
    printf("%d %ld %0.3f %0.3lf", a, b, c, d);
    return 0;
}
        `;
        const expectOutput = `9 -12 3.349 -7.127`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true,
        input: "9 -12 3.35 -7.128"});
    });
});