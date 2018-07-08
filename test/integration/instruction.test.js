const TestBase = require('./testbase');
describe('instruction integration test', function () {
    it('switch case',function() {
        const testCode = `
        int a = 1;
        switch(a){
            case 1: printf("1");
            case 2: printf("2");
            case 3: printf("3");
            default: printf("4");
        }
        a = 2;
        switch(a){
            case 1: printf("1");
            case 2: printf("2");
            case 3: printf("3");
        }
        a = 6;
        switch(a){
            case 1: printf("1");
            case 2: printf("2");
            case 3: printf("3");
            default: printf("4");
        }
        `;
        const expectOutput = `1234234`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('if else elseif',function() {
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
        } else if( b == 4){
            c = 2;
        } else {
            c = 3;
        }
        printf("%d",a);
        printf("%d",b);
        printf("%d",c);
        `;
        const expectOutput = `142`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('while',function() {
        const testCode = `
        int i = 1;
        while( i < 10 ){
            printf("%d", i);
            i ++;
        }
        `;
        const expectOutput = `123456789`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('for',function() {
        const testCode = `
        for(;;){ printf("0"); break; }
        for(int i = 0; i < 5; i++){ printf("%d", i); continue; }
        `;
        const expectOutput = `001234`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('goto',function() {
        const testCode = `
        int a = 1;
        label1:
         printf("1");
         if( a == 1){
            a = 2;
            goto label1;
         }
         printf("2");
         goto label2;
         printf("3");
         label2:
         printf("4");
        `;
        const expectOutput = `1124`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('do-while',function() {
        const testCode = `
        int i = 10;
         do{
            printf("%d", i);
            i --;
        } while( i > 0 );
        `;
        const expectOutput = `10987654321`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('constant compute',function() {

        const testCode = `
        printf("%d,", 1+2-3*4);
        printf("%.3f,", 1.0+2.0-3.0*4.0/5.0);
        printf("%d,", 22&33|44^55);
        printf("%.3f,", 1+4.0*8);
        printf("%d,", 2<=3>=4<5>6==7!=8&&1||1);
        printf("%d,", 6%2);
        `;
        const expectOutput = `-9,0.600,27,33,1,0,`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('unary ope',function() {

        const testCode = `
        int a = 10;
        double d = 7.0;
        printf("%d,%d,%d,%d,", !a, !d, !1, !0.7);
        printf("%d,%.3f,", +a, +d);
        printf("%d,%.3f,", -a, -d);
        printf("%d,", ~a);
        `;
        const expectOutput = `0,0,0,1,10,7,-10,-7,-11,`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('var init',function() {

        const testCode = `
        char a0 = 1;
        unsigned char a1 = 1;
        short a2 = 1;
        unsigned short a3 = 1;
        int a4 = 1;
        unsigned int a5 = 1;
        float a6 = 1;
        double a7 = 1;
        printf("%d%d%d%d%d%d%.3f,",a0,a1,a2,a3,a4,a5,a7);
        printf("%.3f", a6);
        `;
        const expectOutput = `1111111,1`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
});