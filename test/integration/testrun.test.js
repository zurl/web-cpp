const TestBase = require('./testbase');
const fs = require('fs');

const source = `
#include <stdio.h>
struct mystruct{
    int a, b, c;
};
struct mystruct d[10];
int main(){
    int a = 1;
    int &b = 2;
    printf("%d\\n", (*b).a); 
    return 0;
}
`;

const source4=`
#include <stdio.h>

struct A{
    static int bbb;
    int sb = 24;
    A() :sb(26){
        dump_stack_info();
        printf("CTOR: %d\\n", this->sb);
    }
    A(const A & b){
         printf("CCTOR %d\\n", b.sb);
        this->sb = b.sb;
    }
    A(int b){
        this->sb = b;
        printf("CTOR: %d\\n", this->sb);
    }
    ~A(){
        printf("DTOR %d\\n", this->sb);
    }
    static int foo(int a){
        return a + 1;
    }
    int goo(int b){
        printf("%d,", b);
        printf("%d,", this->d);
        printf("%d,", this->d + b);
        return 0;
    }
    int d;
    A operator+(int c){
        //printf(" opertor + \\n");
        A ret;
        ret.d = this->d + c;
        return ret;
    }
    A& operator=(A & a){
        printf("ACTOR %d\\n", a.sb);
        this->d = a.d;
        this->sb = a.sb;
        return *this;
    }
};

int A::bbb;

A returnAObj(int b){
    A a;
    a.d = b;
    return a;
}
A add1(A b){
    A ret(b);
    dump_stack_info();
    printf("ss");
    printf("b:%d, ret:%d\\n", b.sb, ret.sb);
    ret.sb += 122;
    return ret;
}
int main(){
    //A b = returnAObj(3);
    //A q = b + 5;
    A a(123);
    A b = add1(a);
    printf("%d, %d", a.sb, b.sb);
    dump_stack_info();
    dump_stack_info();
    A w = A();
    dump_stack_info();
    printf("%d", w.sb);
    return 0;
}
`;

const source3 = `
#include<stdio.h>
#include<string.h>
        struct Stack{
            int data[100];
            int now = -1;
            void push(int x){
                this->data[++this->now] = x;
                printf("here: %d\\n", this->now);
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
            printf("%d", eval("1+2+3"));
            return 0;
        }


`;
describe('test run', function(){
    it('test run', async function(){
        const result = await TestBase.testRun(source3, {isCpp: true, debug: true, linkStd: true});
        console.log(result);
    })
});