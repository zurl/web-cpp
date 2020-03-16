const TestBase = require('../integration/testbase');
describe('vector test', function () {
    it('test vector',async function() {
        const testCode = `
#include <stdio.h>
template<typename T>
class vector{
    T * data;
    int size;
    int capacity;
    vector(){
        capacity = 10;
        data = (T *) malloc( sizeof(T) * capacity);
        size = 0;
    }
    void expand(){
        int old_capacity = capacity;
        capacity *= 2;
        T * new_data = (T *) malloc( sizeof(T) * capacity); 
        memcpy(new_data, data, sizeof(T) * old_capacity);
        data = new_data;
    }
    void push_back(T t){
        if(size == capacity){
            expand();
        }
        data[size] = t;
        size ++;
    }
    T operator[](int x){
        return data[x];
    }
};

int main(){
    vector<int> a;
    a.push_back(1);
    a.push_back(2);
    a.push_back(3);
    printf("%d %d %d", a[0], a[1], a[2]);
    return 0;
}
        `;
        const expectOutput = `1 2 3`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
});