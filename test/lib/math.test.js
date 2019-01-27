const TestBase = require('../integration/testbase');
describe('math test', function () {
    it('test math',async function() {
        const testCode = `
#include <math.h>
#include <stdio.h>
int main(){
    printf("%0.3f,", acosh(1));
    printf("%0.3f,", asinh(1));
    printf("%0.3f,", atanh(0));
    printf("%0.3f,", acos(1));
    printf("%0.3f,", asin(1));
    printf("%0.3f,", atan(1));
    printf("%0.3f,", cos(1));
    printf("%0.3f,", sin(1));
    printf("%0.3f,", tan(1));
    printf("%0.3f,", fmax(10, 20));
    printf("%0.3f,", fmin(10, 20));
    return 0;
}
        `;
        const expectOutput = `0,0.881,0,0,1.570,0.785,0.540,0.841,1.557,20,10,`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
});