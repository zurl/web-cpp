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
        printf("%d\\n",a);
        printf("%d\\n",b);
        printf("%d\\n",c);
        `;
        const expectOutput = `
        1
        4
        2
        `;
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
    it('do-while',function() {
        const testCode = `
        int i = 10;
         do{
            printf("%d", i);
            i --;
        } while( i > 0 );
        `;
        const expectOutput = `1098765432`;
        TestBase.testRunCompareResult(testCode, expectOutput);
    });
});