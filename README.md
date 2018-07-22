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
- [ ] cc-cli
- [ ] ?:
- [ ] 对局部变量取地址
- [ ] const
- [ ] bit field of struct
- [ ] malloc
- [ ] only export necessary scopeMap
- [ ] #if #elif
- [ ] #line __line__ __file__
- [ ] & array alias
- [ ] &
- [ ] int64
## C++ Language
- [ ] 异常处理
- [X] 左值引用
- [X] 静态成员变量
- [ ] 构造函数
- [ ] DTOR
- [ ] copy-ctor, copy-assignment-ctor
- [ ] 访问控制
- [X] 静态成员函数
- [X] 成员函数
- [ ] 虚成员函数
- [X] 函数重载
- [ ] 成员函数重载
- [ ] 运算符重载
- [ ] using
- [ ] 函数模板
- [ ] class模板
- [ ] new/delete
- [ ] typeid
- [ ] 构造函数
- [ ] namespace
