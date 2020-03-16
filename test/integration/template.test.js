const TestBase = require('./testbase');
describe('template integration test', function () {
    it('test explicit function template', async function () {
        const testCode = `
#include <stdio.h>
template <typename T = int, int Y = 4>
float foo(T a){
    float g = a + Y;
    return g;
}

template float foo<int, 4>(int a);
template float foo<int, 8>(int a);
template float foo<float, 8>(float a);

int main(){
    printf("%f", foo(1));
    printf("%f", foo<int>(1));
    printf("%f", foo<int, 8>(1));
    printf("%f", foo<float, 8>(1.5f));
    return 0;
}
        `;
        const expectOutput = `5599.5`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test implicit function template', async function () {
        const testCode = `
#include <stdio.h>
template <typename T = int, int Y = 4>
float foo(T a){
    float g = a + Y;
    return g;
}
int main(){
    printf("%f", foo(1));
    printf("%f", foo<int>(1));
    printf("%f", foo<int, 8>(1));
    printf("%f", foo<float, 8>(1.5f));
    return 0;
}
        `;
        const expectOutput = `5599.5`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test implicit function specialization', async function () {
        const testCode = `
#include <stdio.h>
template <typename T = int, int Y = 4>
float foo(T a){
    float g = a + Y;
    return g;
}

template <>
float foo<double, 12>(double a){
    return 99;
}

int main(){
    printf("%f", foo(1));
    printf("%f", foo<int>(1));
    printf("%f", foo<int, 8>(1));
    printf("%f", foo<float, 8>(1.5f));
    printf("%f", foo<double, 12>(1.5));
    return 0;
}
        `;
        const expectOutput = `5599.599`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test class template', async function () {
        const testCode = `
#include <stdio.h>

template <typename T = int, int Y = 4>
class Foo{
    int getSize(){
        return sizeof(T);
    }
    int getY(){
        return Y;
    }
};

int main(){
    Foo f1;
    Foo<double> f2;
    Foo<char, 12> f3;
    printf("%d %d,", f1.getSize(), f1.getY());
    printf("%d %d,", f2.getSize(), f2.getY());
    printf("%d %d,", f3.getSize(), f3.getY());
    return 0;
}
        `;
        const expectOutput = `4 4,8 4,1 12,`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test class template template member function', async function () {
        const testCode = `
#include <stdio.h>

template <typename T = int, int Y = 4>
class Foo{
public:
    int x;
    Foo(int g): x(g){}

    template <typename U>
    int getSize(U p){
        return sizeof(T) + sizeof(U) + Y + x;
    }
    
};

int main(){
    Foo f1(1);
    Foo<double> f2(2);
    Foo<char, 12> f3(3);
    int a = 1;
    char b = 2;
    short c = 3;
    printf("%d %d %d,", f1.getSize(a), f1.getSize(b), f1.getSize(c));
    printf("%d %d %d,", f2.getSize(a), f2.getSize(b), f2.getSize(c));
    printf("%d %d %d,", f3.getSize(a), f3.getSize(b), f3.getSize(c));
    return 0;
}
        `;
        const expectOutput = `13 10 11,18 15 16,20 17 18,`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
    it('test class template inside class template', async function () {
        const testCode = `
#include <stdio.h>

template <typename T = int, int Y = 4>
class Foo{

    template<typename U>
    class Goo{
        int getSize(){
            return sizeof(T) + sizeof(U);
        }
        
        int getY(){
            return Y;
        }
    };
    
    int getSize(){
        return sizeof(T);
    }
};

int main(){
    Foo<double>::Goo<int> f1;
    Foo<double, 8>::Goo<int> f2;
    Foo<char, 12>::Goo<int> f3;
    printf("%d %d,", f1.getSize(), f1.getY());
    printf("%d %d,", f2.getSize(), f2.getY());
    printf("%d %d,", f3.getSize(), f3.getY());
    return 0;
}
        `;
        const expectOutput = `12 4,12 8,5 12,`;
        return await TestBase.testFullCode(testCode, expectOutput, {isCpp: true});
    });
});
