const TestBase = require('./testbase');
describe('template integration test', function () {
    it('test function template', async function () {
        const testCode = `
#include <stdio.h>
template <typename T = int, int Y = 4>
float foo(T a){
    float g = a + Y;
    return g;
}

template float foo<int, 4>(int a);
template float foo<int, 8>(int a);
template float foo<float, 8>(float a);

int main(){
    printf("%f", foo(1));
    printf("%f", foo<int>(1));
    printf("%f", foo<int, 8>(1));
    printf("%f", foo<float, 8>(1.5));
    return 0;
}
        `;
        const expectOutput = `5599.5`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
});