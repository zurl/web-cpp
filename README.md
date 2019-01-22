# web-cpp
[![Build Status](https://www.travis-ci.org/zurl/web-cpp.svg?branch=master)](https://www.travis-ci.org/zurl/web-cpp)
[![Coverage Status](https://coveralls.io/repos/github/zurl/web-cpp/badge.svg?branch=master)](https://coveralls.io/github/zurl/web-cpp)

A experimental c++ compiler in typescript

online demo => [zurl.github.io/web-cpp](https://zurl.github.io/web-cpp)

# Introduction

This project is a In-browser C++ Compiler and Runtime toolchains,
which requires no server and could run in all major browsers.

Our compiler could compile C++ to [WebAssembly](https://webassembly.org/),
which is a low-level programming language. WebAssembly is supported by most
browsers currently, it is much more faster than JavaScript, and able to be compiled
from all static languages.

[LLVM](http://llvm.org/) provides excellent support of WebAssembly Backend, our
compiler is inspired by them and learned a lot from its good design.

Our Compiler and Runtime is much more fast than all C++ interpreter in browser,
the c++ code will be compiled directly to WebAssembly, and WebAssembly will be
executed by high performance JIT execution engine in our browser. According to our
experiment, our compiler could have nearly same performance to gcc/g++ without
optimization.

## How to Use

1. build web-cpp compiler itself

```shell
npm install
npm run build
npm run test
```

2. build the web-cpp online ide

we use parcel as our packager, you could use any kind of web packager with your
custom configuration.

```shell
npm run build
cd ide
parcel build index.html
```

## Demo
use `./cc` as local runtime (Node.js)

```shell
./cc run resource/testcodes/demo.cpp
```


# How to develop/extend

Our Compiler is designed as a loosely coupled,
componentized compiler, so it is easy for you to extend or
further develop our compiler system.

## Write Javascript Library

The Javascript Library in our library is called "syscall",
which is similar to UNIX syscall concept.

Before you add new JavaScript syscall, you should write a
header file in `resource/libstdcpp/include`, you could
extend or create new cpp file in the directory. The syntax
is similar to ordinary C++ function declaration, but you
need a `__libcall` prefix before your declaration.

The syscall code is located in `src/library/syscall.ts`,
please just write plain js function (not arrow function) that
receive js number and return js number or none. The `this` pointer
of js function will be WASM runtime, you could access C++
Virtual Machine via `this` pointer, string could be pass by
memory address.

After any modification, please run `npm run build` to refresh
the binary library file.

## Write C++ Library

Similarly, Library in C++ is also supported by our system,
your need to add `.h` file in `resource/libstdcpp/include`
and `.cpp` file in `resource/libstdcpp/lib`, our compiler
will automatically load these files if you build the compiler.

After any modification, please run `npm run build` to refresh
the binary library file.

## Add new C++ Grammar

Our grammar files are located in `resource/grammar`, it is divided into
several files for readability, the file are in [parsing expression grammar](https://en.wikipedia.org/wiki/Parsing_expression_grammar)
which supported by PEG.js(https://pegjs.org/), you could write your own rules
to extend our compiler.

After any modification, please run `npm run build` to refresh
the binary parser file.

## Using WebAssembly Backend

Our compiler has a high-level abstraction of WebAssembly AST,
which located in `src/wasm` directory,

The WASM AST is abstracted in a tree-like structure,
the hierarchy is WModule -> WSection -> WStatement -> WExpression
WExpression is the minimal unit of WASM AST, it could emit a return
value, and consume by WStatement. WStatements contains several
control flow structure, and several WStatements will be composed
to a WCodeSection.

For other WSection, you could refer to the official standard
of WebAssembly.


# Road Map

## Version

- [X] 0.4 Classic C with class support
- [X] 0.5 With interpreter runtime
- [X] 0.6 With function template
- [ ] 0.7 With class template
- [ ] 0.8 With std library (some)

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
- [X] debuginfo
- [ ] repeative param name detect
## C++ Language
- [X] default parameter
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
- [X] inheriant
- [X] operator overload => working, bin->ok, unary->working, syntax
- [X] implict this
- [ ] public/private/ protect, access control (syntax ok, todo)
- [X] new/delete
- [X] new array []
- [X] using
- [X] namespace
- [X] virtual member function
- [ ] cast overload， like if(object) { ... }
- [not support by wasm] exception handling
- [X] function template
- [ ] member function template in class
- [ ] class template
- [ ] const/override/virtual member function
- [ ] typeinfo
- [ ] static_cast / dynamic_cast / reinterpret_cast
- [ ] mangled/demangled
- [ ] virtual inheriant
- [ ] seperate define class function
- [ ] operator new/ placement new
- [ ] warning
- [ ] using template
## ide
- [ ] multi-language
- [ ] config
- [ ] help


## temporary problems
- [ ] A a[50] decons
- [ ] template class in template class
- [ ] template member function
- [ ] seperate delaration
- [ ] only declare template (template declar)
- [ ] id could not be keyword
- [ ] function lookup result not elegant
- [ ] 子类B里A::a
## Naming Guidance

The name in web-cpp could be classified into 3 kinds
```c++
namespace A{
    namespace B{
        class C;
    }
    class B::C{

    };
}
```c++

for class C
shortName    C                                  for describe itself
lookupName   C(无限定查找）
             B::C/A::B::C（限定查找）
             ::A::B::C（完全限定查找）             for lookup
fullName     ::A::B::C                          for describe certain path of a element

ScopeManager
lookup(lookupName) => Symbol
getFullName(lookupName) => FullName
declare(fullName, Symbol)
define(fullName, Symbol)
enterSymbolScope(lookupName) / exitSymbolScope()
enterInnerScope() / exitInnerScope();

声明
无限定查找 非同级作用域覆盖 同级作用域冲突检查
限定查找 有同样声明跳过 其他不被允许

定义
无限定查找 非同级作用域覆盖 同级作用域声明补充 同级作用域定义不被允许
限定查找 预先声明require 默认行为补充





## Miscellaneous

This project is my thesis of my bachelor's degree, which is inspired by
the rapid development of online programing education. This project is
targeted to improve the C++ learning experience for new students,
thanks to everyone who helps me in the development of this project.