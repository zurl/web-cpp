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
- [ ] ?:
- [ ] bit field of struct
- [ ] only export necessary scopeMap / debuginfo
- [ ] #if #elif
- [ ] #line __line__ __file__
- [ ] remove Long.js
- [ ] repeative param name detect
## C++ Language
- [ ] __cxx_global_var_init
- [ ] mangled/demangled
- [X] default constructor
- [ ] copy-constructor(use memcpy)
- [X] destructor
- [ ] 异常处理
- [ ] 继承
- [X] 左值引用
- [X] 静态成员变量
- [X] 形如 A a(c,d)的初始化
- [X] 构造函数 => 设计
- [ ] inner scope => { }
- [X] DTOR => 文法中
- [X] ctor initialize list
- [ ] copy-ctor
- [X]copy-assignment-ctor
- [ ] 访问控制
- [X] 静态成员函数
- [X] 成员函数
- [ ] 虚成员函数
- [X] 函数重载
- [X] 成员函数重载
- [ ] 运算符重载 => working, binok, unary->working
- [ ] using
- [ ] 函数模板
- [ ] const/override/virtual member function
- [ ] class模板
- [ ] new/delete
- [ ] typeinfo
- [ ] namespace
- [ ] static_cast / dynamic_cast / reinterpret_cast