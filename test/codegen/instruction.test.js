const TestBase = require('./testbase');

describe('instruction test', function () {
    it('test a + b', function () {
        const testCode = `
        int a;
        int b;
        int c;
        c = a + b;
        `;
        const expectCode = `
        LBP 0
        LM32
        LBP -4
        LM32
        ADD
        LBP -8
        SM32
        `;
        TestBase.testCode(testCode, expectCode);
    });
    it('test + - * / %', function () {
        const testCode = `
        int a;
        int b;
        int c;
        c = a + b - b * b / b % b;
        `;
        const expectCode = `
        LBP 0
        LM32
        LBP -4
        LM32
        ADD
        LBP -4
        LM32
        LBP -4
        LM32
        MUL
        LBP -4
        LM32
        DIV
        LBP -4
        LM32
        MOD
        SUB
        LBP -8
        SM32
        `;
        TestBase.testCode(testCode, expectCode);
    });
    it('test pointer', function () {
        const testCode = `
        short * a;
        short b;
        short ** c;
        short ** d;
        short *** e;
        a = &b;
        b = *&b;
        b = *a;
        *a = b;
        *a = *a;
        **c = **d;
        ***e =***e;
        `;
        const expectCode = `
        LBP -4
        LBP 0
        SM32
        LBP -4
        LM16
        LBP -4
        SM16
        LBP 0
        LM32
        LM16
        LBP -4
        SM16
        LBP -4
        LM16
        LBP 0
        LM32
        SM16
        LBP 0
        LM32
        LM16
        LBP 0
        LM32
        SM16
        LBP -10
        LM32
        LM32
        LM16
        LBP -6
        LM32
        LM32
        SM16
        LBP -14
        LM32
        LM32
        LM32
        LM16
        LBP -14
        LM32
        LM32
        LM32
        SM16
        `;
        TestBase.testCode(testCode, expectCode);
    });
});
