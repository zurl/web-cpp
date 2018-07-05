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
        SSP -12
        PBP -4
        LM32
        PBP -8
        LM32
        ADD
        PBP -12
        SM32
        `;
        TestBase.testCode(testCode, expectCode);
    });
    it('test + - * / %', function () {
        const testCode = `
        int a, b, c;
        double e, f, g;
        c = a + b - b * b / b % b;
        g = e + f - f * f / f % f;
        `;
        const expectCode = `
        SSP -36
        PBP -4
        LM32
        PBP -8
        LM32
        ADD
        PBP -8
        LM32
        PBP -8
        LM32
        MUL
        PBP -8
        LM32
        DIV
        PBP -8
        LM32
        MOD
        SUB
        PBP -12
        SM32
        PBP -20
        LM64
        PBP -28
        LM64
        ADDF
        PBP -28
        LM64
        PBP -28
        LM64
        ADDF
        PBP -28
        LM64
        ADDF
        PBP -28
        LM64
        ADDF
        ADDF
        PBP -36
        SM64
        `;
        TestBase.testCode(testCode, expectCode);
    });
    it('test < > <= >= == !=', function () {
        const testCode = `
        int a;
        int b;
        double c;
        double d;
        int e;
        e = a > b;
        e = a < b;
        e = a == b;
        e = a != b;
        e = a >= b;
        e = a <= b;
        e = c > d;
        e = c < d;
        e = c == d;
        e = c != d;
        e = c >= d;
        e = c <= d;
        `;
        const expectCode = `
        SSP -28
        PBP -4
        LM32
        PBP -8
        LM32
        SUB
        GT0
        PBP -28
        SM32
        PBP -4
        LM32
        PBP -8
        LM32
        SUB
        LT0
        PBP -28
        SM32
        PBP -4
        LM32
        PBP -8
        LM32
        SUB
        EQ0
        PBP -28
        SM32
        PBP -4
        LM32
        PBP -8
        LM32
        SUB
        NEQ0
        PBP -28
        SM32
        PBP -4
        LM32
        PBP -8
        LM32
        SUB
        GTE0
        PBP -28
        SM32
        PBP -4
        LM32
        PBP -8
        LM32
        SUB
        LTE0
        PBP -28
        SM32
        PBP -16
        LM64
        PBP -24
        LM64
        SUBF
        D2I
        GT0
        PBP -28
        SM32
        PBP -16
        LM64
        PBP -24
        LM64
        SUBF
        D2I
        LT0
        PBP -28
        SM32
        PBP -16
        LM64
        PBP -24
        LM64
        SUBF
        D2I
        EQ0
        PBP -28
        SM32
        PBP -16
        LM64
        PBP -24
        LM64
        SUBF
        D2I
        NEQ0
        PBP -28
        SM32
        PBP -16
        LM64
        PBP -24
        LM64
        SUBF
        D2I
        GTE0
        PBP -28
        SM32
        PBP -16
        LM64
        PBP -24
        LM64
        SUBF
        D2I
        LTE0
        PBP -28
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
        SSP -20
        PBP -8
        PBP -4
        SM32
        PBP -8
        LM16
        PBP -8
        SM16
        PBP -4
        LM32
        LM16
        PBP -8
        SM16
        PBP -8
        LM16
        PBP -4
        LM32
        SM16
        PBP -4
        LM32
        LM16
        PBP -4
        LM32
        SM16
        PBP -16
        LM32
        LM32
        LM16
        PBP -12
        LM32
        LM32
        SM16
        PBP -20
        LM32
        LM32
        LM32
        LM16
        PBP -20
        LM32
        LM32
        LM32
        SM16
        `;
        TestBase.testCode(testCode, expectCode);
    });
});
