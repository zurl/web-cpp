# web-cpp
[![Build Status](https://www.travis-ci.org/zurl/web-cpp.svg?branch=master)](https://www.travis-ci.org/zurl/web-cpp)
[![Coverage Status](https://coveralls.io/repos/github/zurl/web-cpp/badge.svg)](https://coveralls.io/github/zurl/web-cpp)

a experimental c++ compiler in typescript

online demo => [zurl.github.com/web-cpp](zurl.github.com/web-cpp)

## usage

1. build web-cpp compiler itself

```shell
npm install
npm install -g typescript nyc mocha
npm run build
npm run test
```

2. build the web-cpp online ide

```shell
npm install -g parcel
npm run build
cd ide
parcel build index.html
```


## DEMO
use `./cc` as local runtime (Node.js)

```shell
./cc run resource/testcodes/demo.cpp
```

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
- [X] local address
- [X] const
- [X] malloc need
- [X] & array alias
- [X] &
- [X] int64
- [X] ?:
- [X] function pointer
- [X] array initial list
- [X] multi-dim array
- [ ] #if #elif
- [ ] bit field of struct
- [ ] #line __line__ __file__
- [ ] remove Long.js
- [ ] debuginfo
- [ ] repeative param name detect
## C++ Language
- [X] default constructor
- [X] copy-constructor(use memcpy)
- [X] temporary object destruction
- [X] destructor
- [X] left reference
- [X] static member variable
- [X] A a(c,d)
- [X] ctor
- [X] inner scope
- [X] DTOR
- [X] ctor initialize list
- [X] copy-ctor
- [X] copy-assignment-ctor
- [X] static member function
- [X] member function
- [X] function overload
- [X] member function overload
- [X] __cxx_global_var_init
- [X] 继承
- [X] 运算符重载 => working, bin->ok, unary->working, syntax不全
- [X] implict this
- [ ] public/private/ protect, 访问控制 (syntax ok, todo)
- [X] new/delete
- [X] new array []
- [X] using
- [X] namespace
- [ ] 类型转换重载， like if(object) { ... }
- [ ] 异常处理
- [ ] 虚成员函数
- [ ] 函数模板
- [ ] const/override/virtual member function
- [ ] class模板
- [ ] typeinfo
- [ ] static_cast / dynamic_cast / reinterpret_cast
- [ ] mangled/demangled
- [ ] virtual inheriant
- [ ] seperate define class function
- [ ] operator new/ placement new