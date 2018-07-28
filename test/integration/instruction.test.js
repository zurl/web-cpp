const TestBase = require('./testbase');
const {TypeError} = require("../../dist/common/error");
describe('instruction integration test', function () {
    it('test address',async function() {
        const testCode = `
#include <stdio.h>
        int a = 0;
        int b;
        int main(){
            int c;
            a = 1;
            b = 2;
            c = 3;
            int d = a;
            d = b;
            d = c;
            printf("%d%d%d%d", a, b, c, d);
            return 0;
        }
        `;
        const expectOutput = `1233`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test const init',async function() {
        const testCode = `
#include <stdio.h>
        char a = 1;
        unsigned char b = 2;
        short c = 3;
        unsigned short d = 4;
        int e = 5;
        unsigned int f = 6;
        long long g = 7;
        unsigned long long h = 8;
        
        float a0 = 1.0f;
        double a1 = 1.14;
        int main(){
            printf("%d%d%d%d,", a, b, c, d);
            printf("%d%d,", e, f);
            printf("%lf,%lf,", a0, a1);
            return 0;
        }
        `;
        const expectOutput = `1234,56,1,1.14,`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('test const string',async function() {
        const testCode = `
#include <stdio.h>
        const char * str = "Hello World";
        const char * fmt = "%s,%%,%s";
        int main(){
            printf(fmt, str, str);
            return 0;
        }
        `;
        const expectOutput = `Hello World,%,Hello World`;
        return await TestBase.testFullCode(testCode, expectOutput);
    });
    it('switch case',async function() {
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
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('if else elseif',async function() {
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
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('while',async function() {
        const testCode = `
        int i = 1;
        while( i < 10 ){
            printf("%d", i);
            i ++;
        }
        `;
        const expectOutput = `123456789`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('for', async function() {
        const testCode = `
        for(;;){ printf("0"); break; }
        for(int i = 0; i < 5; i++){ printf("%d", i); continue; }
        `;
        const expectOutput = `001234`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('do-while', async function() {
        const testCode = `
        int i = 10;
         do{
            printf("%d", i);
            i --;
        } while( i > 0 );
        `;
        const expectOutput = `10987654321`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('complex flow', async function() {

        const testCode = `
        for(int i = 0; i < 10 ; i++){
            printf("%d", i);
            if( i >= 6) {
                printf("$");
                if( i == 7){
                    break;
                } 
                else {
                     continue;
                }
            }
            printf("@");
        }
        `;
        const expectOutput = `0@1@2@3@4@5@6$7$`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('array', async function() {
        const testCode = `
        int arr[100];
        arr[0] = 1;
        arr[1] = 1;
        for(int i = 2; i < 10; i++){
            arr[i] = arr[i - 1] + arr[i - 2];
            printf("%d", arr[i]);
        }
        `;
        const expectOutput = `235813213455`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('constant compute', async function() {

        const testCode = `
        printf("%d,", 1+2-3*4);
        printf("%.3lf,", 1.0+2.0-3.0*4.0/5.0);
        printf("%d,", 22&33|44^55);
        printf("%.3lf,", 1+4.0*8);
        printf("%d,", 2<=3>=4<5>6==7!=8&&1||1);
        printf("%d,", 6%2);
        `;
        const expectOutput = `-9,0.600,27,33,1,0,`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('unary ope', async function() {

        const testCode = `
        int a = 10;
        double d = 7.0;
        printf("%d,%d,%d,%d,", !a, !d, !1, !0.7);
        printf("%d,%.3lf,", +a, +d);
        printf("%d,%.3lf,", -a, -d);
        printf("%d,", ~a);
        `;
        const expectOutput = `0,0,0,1,10,7,-10,-7,-11,`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('var init', async function() {

        const testCode = `
        char a0 = 1;
        unsigned char a1 = 1;
        short a2 = 1;
        unsigned short a3 = 1;
        int a4 = 1;
        unsigned int a5 = 1;
        float a6 = 1;
        double a7 = 1;
        printf("%d%d%d%d%d%d%.3lf,",a0,a1,a2,a3,a4,a5,a7);
        printf("%.3lf", a6);
        `;
        const expectOutput = `1111111,1`;
        return await TestBase.testRunCompareResult(testCode, expectOutput);
    });
    it('test pointer conversion', async function() {
        const testCode = `
        int a = 123;
        int *b = &a;
        int *c = &b;
        `;
        try{
            await TestBase.testRunCompareResult(testCode, '', false);
            TestBase.assert.isTrue(false);
        } catch (e) {
            if( !(e instanceof TypeError)){
                throw e;
            }
        }
    });
    it('test pointer', async function() {
        const testCode = `
        int a = 123;
        int *b = &a;
        printf("%d,", *b);
        
        int **c = &b;
        printf("%d,", **c);
        
        **c = 72;
        printf("%d,", a);
        
        int d = 999;
        int *e = &d;
        int **f = &e;
        **c = **f;
        printf("%d,", a);
        
        `;
        const expectOutput = `123,123,72,999,`;
        return await TestBase.testRunCompareResult(testCode, expectOutput, false);
    });
    it('bb sort', async function(){
        const testCode = `
        int a[10];
        a[0] = 1;
        a[1] = 1;
        a[2] = 4;
        a[3] = 5;
        a[4] = 1;
        a[5] = 4;
    
        // bb sort
        int n = 6;
        for(int i = 0; i < n; i++){
            for(int j = 0; j < i; j++){
                if(a[j] > a[j + 1]){
                    int t = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = t;
                }
            }
        }
    
        //output
        for(int k = 0; k < n; k++){
            printf("%d", a[k]);
        }
    `;
        const expectOutput = `111445`;
        return await TestBase.testRunCompareResult(testCode, expectOutput, false);
    });
    it('reference ', async function(){
        const testCode = `
#include <stdio.h>
        void foo(int & b){
            b = 3;
        }
        int main(){
            int a = 1;
            int &b = a;
            int &c = a;
            printf("%d", a);
            foo(a);
            printf("%d", a);
            foo(b);
            printf("%d", a);
            return 0;
        }
    `;
        const expectOutput = `133`;
        return await TestBase.testFullCode(testCode, expectOutput, true, true);
    })
    it('test int64 ', async function(){
        const testCode = `
#include <stdio.h>
        long long int64add(long long a, long long b){
            return a + b;
        }
        int main(){
            long long a = 21974836471230LL;
            long long b = 21974836471233333LL;
            printf("%ld", int64add(a, b));
            return 0;
        }
    `;
        const expectOutput = `21996811307704563`;
        return await TestBase.testFullCode(testCode, expectOutput, true, true);
    });
    it('test & ', async function(){
        const testCode = `
#include <stdio.h>
        int a1[10];
        
        int main(){
            int a2[10];
            int c = 20;
            int * b = &a1;
            int * d = &c;
            b[0] = 13;
            *d += 1;
            printf("%d,%d,%d,%d", b[0], d[0], a1[0], c);
            return 0;
        }
    `;
        const expectOutput = `13,21,13,21`;
        return await TestBase.testFullCode(testCode, expectOutput, true, true);
    })

});