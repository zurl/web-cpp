const TestBase = require('./testbase');
describe('big test', function () {
    it('test quicksort', async function () {
        const testCode = `
#include<stdio.h>
        void quicksort(int number[],int first,int last){
           int i, j, pivot, temp;
        
           if(first<last){
              pivot=first;
              i=first;
              j=last;
        
              while(i<j){
                 while(number[i]<=number[pivot]&&i<last)
                    i++;
                 while(number[j]>number[pivot])
                    j--;
                 if(i<j){
                    temp=number[i];
                    number[i]=number[j];
                    number[j]=temp;
                 }
              }
        
              temp=number[pivot];
              number[pivot]=number[j];
              number[j]=temp;
              quicksort(number,first,j-1);
              quicksort(number,j+1,last);
           }
        }
        int main(){
            int array[50] = {1, 9, 9, 7, 7, 9, 9, 1};
              
            quicksort(array, 0, 7);
            for(int i = 0; i < 8; i++){
                printf("%d", array[i]);
            }
            return 0;
        }
        `;
        const expectOutput = `11779999`;
        return await TestBase.testFullCode(testCode, expectOutput, true, true);
    });
});