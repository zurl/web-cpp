const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>
struct mystruct{
    int a, b, c;
};
struct mystruct d[10];
int main(){
struct mystruct u[10];
    int a[100];
    struct mystruct * b = u+7;
    (*b).a=14;
    printf("%d\\n", (*b).a); 
    return 0;
}
`;

const source3=`
#include <stdio.h>

int main(){
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
        for(int j = 0; j < i - 1; j++){
            if(a[j] > a[j + 1]){
                printf("swap %d %d\\n", i, j);
                int t = a[j];
                a[j] = a[j + 1];
                a[j + 1] = t;
            }
        }
    }

    //output
    for(int k = 0; k < n; k++){
        printf("%d ", a[k]);
    }
    printf("\\n");
    return 0;
}
`;

describe('test run', function(){
    it('test run', function(){
        const result = TestBase.testRun(source3, true);
        console.log(result);
    })
});