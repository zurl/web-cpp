const TestBase = require('./testbase');
describe('instruction integration test', function () {
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
});