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
    it('test struct',function(){
        const testCode = `
        struct S1;
        struct S0{};
        struct S1{
            int a;          // + 0 - + 3
            char b;         // + 4 - + 4
            struct S1 * c;  // + 5 - +12
        };
        int main(){
           struct S1 s1;    // -12
           struct S1 s2;    // -24
           struct S1 * s2p;    // -24
           s1.a = 1;        // -12
           s1.b = 2;        // -8
           s1.c = &s2;      // -7
           s2.a = 3;        
           s2.b = 4;
           s2.c = &s1;
           s2p = &s2;
        }
        `;
        const expectCode = `
        SSP -28
        PI32 1
        PBP -12
        SM32
        PI32 2
        PBP -8
        SM8
        PBP -24
        PBP -7
        SM32
        PI32 3
        PBP -24
        SM32
        PI32 4
        PBP -20
        SM8
        PBP -12
        PBP -19
        SM32
        PBP -24
        PBP -28
        SM32
        `;
        TestBase.testFullCode(testCode, expectCode);
    });
    it('if else elseif',function(){
        const testCode = `
        int a = 1;
        int b = 2;
        int c = 3;
        if( a == 0 ){
            b = 3;
        }
        if( a == 1 ){
            b = 4;
        } else {
            b = 5;
        }
        if(b == 1){
            c = 1;
        } else if( b == 3){
            c = 2;
        } else {
            c = 3;
        }
        `;
        const expectCode = `
        SSP -12
        PI32 1
        PBP -4
        SM32
        PI32 2
        PBP -8
        SM32
        PI32 3
        PBP -12
        SM32
        PBP -4
        LM32
        PI32 0
        SUB
        EQ0
        JZ 16
        PI32 3
        PBP -8
        SM32
        PBP -4
        LM32
        PI32 1
        SUB
        EQ0
        JZ 21
        PI32 4
        PBP -8
        SM32
        J 16
        PI32 5
        PBP -8
        SM32
        PBP -8
        LM32
        PI32 1
        SUB
        EQ0
        JZ 21
        PI32 1
        PBP -12
        SM32
        J 50
        PBP -8
        LM32
        PI32 3
        SUB
        EQ0
        JZ 21
        PI32 2
        PBP -12
        SM32
        J 16
        PI32 3
        PBP -12
        SM32
        `;
        TestBase.testCode(testCode, expectCode);
    })
});
/*
 it('',function(){
        const testCode = `
        `;
        const expectCode = `
        `;
        TestBase.testCode(testCode, expectCode);
    })
 */
