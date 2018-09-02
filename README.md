# web-cpp
[![Build Status](https://www.travis-ci.org/zurl/web-cpp.svg?branch=master)](https://www.travis-ci.org/zurl/web-cpp)
[![Coverage Status](https://coveralls.io/repos/github/zurl/web-cpp/badge.svg?branch=master)](https://coveralls.io/github/zurl/web-cpp)

A experimental c++ compiler in typescript

online demo => [zurl.github.io/web-cpp](https://zurl.github.io/web-cpp)

# Introduction in brief

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

## usage

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


## DEMO
use `./cc` as local runtime (Node.js)

```shell
./cc run resource/testcodes/demo.cpp
```

# Road Map

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
- [ ] exception handling
- [ ] function template
- [ ] const/override/virtual member function
- [ ] class template
- [ ] typeinfo
- [ ] static_cast / dynamic_cast / reinterpret_cast
- [ ] mangled/demangled
- [ ] virtual inheriant
- [ ] seperate define class function
- [ ] operator new/ placement new


## miscellaneous

This project is my thesis of my bachelor's degree, which is inspired by
the rapid development of online programing education. This project is
targeted to improve the C++ learning experience for new students,
thanks to everyone who helps me in the development of this project.
