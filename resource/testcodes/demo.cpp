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
    printf("%d\n", eval("1+2*4"));
    printf("%d\n", eval("2*4+1"));
    return 0;
}