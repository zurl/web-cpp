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
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test c_eval', async function () {
        const testCode = `
#include<stdio.h>
#include<string.h>
        struct Stack{
            int data[100];
            int now = -1;
            void push(int x){
                this->data[++this->now] = x;
            }
            int pop(){
                this->now--;
                return this->data[this->now + 1];
            }
            int isEmpty(){
                return this->now == -1;
            }
            int top(){
                return this->data[this->now];
            }
        };
        int getOptLevel(int x){
            if( x == '+' || x == '-' ) return 1;
            else return 2;
        }
        void doCompute(Stack & numStack, Stack & opeStack){
            int rhs = numStack.pop();
            int lhs = numStack.pop();
            int ope = opeStack.pop();
            switch(ope){
                case '+': numStack.push(lhs + rhs); break;
                case '-': numStack.push(lhs - rhs); break;
                case '*': numStack.push(lhs * rhs); break;
                case '/': numStack.push(lhs / rhs); break;
            }
        }
        int eval(const char * expr){
            Stack numStack, opeStack;
            numStack.push(2);
            int len = strlen(expr);
            int num = 0;
            for(int i = 0; i < len; i++){
                if( expr[i] >= '0' && expr[i] <= '9' ){
                    num = num * 10 + expr[i] - '0';    
                } else {
                    numStack.push(num);
                    num = 0;
                    int opt = getOptLevel(expr[i]);
                    while( (!opeStack.isEmpty()) && (getOptLevel(opeStack.top()) > opt)){
                        doCompute(numStack, opeStack);
                    }
                    opeStack.push(expr[i]);
                }
            }
            numStack.push(num);
            while(!opeStack.isEmpty()){
                doCompute(numStack, opeStack);
            }
            return numStack.pop();
        }
        int main(){
            printf("%d,", eval("1+2*4"));
            printf("%d,", eval("2*4+1"));
            return 0;
        }
        `;
        const expectOutput = `9,9,`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true, linkStd: true, debug: true});
    });
});