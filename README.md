# web-cpp
[![Build Status](https://www.travis-ci.org/zurl/web-cpp.svg?branch=master)](https://www.travis-ci.org/zurl/web-cpp)
[![Coverage Status](https://coveralls.io/repos/github/zurl/web-cpp/badge.svg)](https://coveralls.io/github/zurl/web-cpp)


a experimental c++ compiler in typescript

## usage

```shell
npm install
npm install -g typescript nyc mocha
npm run build
npm run test
```

## Notes

Name Mangling

global var: @var1
local var:  @foo@var1

# todolist

## Road Map

-2018.8.4 new，__cxx_global_var_init，namespace， using

## C language

- [X] function call codegen / return codegen
- [X] & && | || >> <<
- [X] ++ --
- [X] \+ \- ! ~
- [X] += -= *= /= ...
- [X] vm
- [X] array
- [X] sizeof
- [X] typedef
- [X] union
- [X] js native function
- [X] string
- [X] var initilizer
- [X] data segment data
- [X] doConstant about < > <= >= == & && | || >> << ...
- [X] struct / class
- [X] cast ope (hard)
- [X] void return type;
- [X] function call parameter type conversion
- [X] var args
- [X] allocator
- [X] char * a = "123"
- [X] write, read
- [X] printf
- [X] postfix ++ --
- [X] do-while
- [X] break continue
- [deprecated] goto label
- [X] switch case
- [X] enum
- [X] non-return detect
- [X] js highlevel api
- [X] constant fold on tree
- [X] init instructions
- [X] print sourceMap
- [X] cc-cli
- [X] 对局部变量取地址
- [X] const
- [X] malloc need
- [X] & array alias
- [X] &
- [X] int64
- [X] ?:
- [X] 函数指针
- [X] `重要` array initial list
- [X] `重要` multi-dim array
- [ ] `重要` #if #elif
- [ ] bit field of struct
- [ ] only export necessary scopeMap / debuginfo
- [ ] #line __line__ __file__
- [ ] remove Long.js
- [ ] repeative param name detect
## C++ Language
- [X] default constructor
- [X] copy-constructor(use memcpy)
- [X] temporary object destruction
- [X] destructor
- [X] 左值引用
- [X] 静态成员变量
- [X] 形如 A a(c,d)的初始化
- [X] 构造函数 => 设计
- [X] inner scope => { }
- [X] DTOR => 文法中
- [X] ctor initialize list
- [X] copy-ctor
- [X] copy-assignment-ctor
- [X] 静态成员函数
- [X] 成员函数
- [X] 函数重载
- [X] 成员函数重载
- [X] __cxx_global_var_init
- [ ] new/delete
- [ ] 运算符重载 => working, bin->ok, unary->working, syntax不全
- [ ] 类型转换重载， like if(object) { ... }
- [ ] 异常处理
- [ ] 继承
- [ ] 访问控制
- [ ] 虚成员函数
- [ ] using
- [ ] namespace
- [ ] 函数模板
- [ ] const/override/virtual member function
- [ ] class模板
- [ ] typeinfo
- [ ] static_cast / dynamic_cast / reinterpret_cast
- [ ] mangled/demangled