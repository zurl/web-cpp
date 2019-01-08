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
- [ ] 0.6 (DLC1) With template
- [ ] 0.7 (DLC2) With std library (some)

## C language

- [X] function call codegen / return codegen
- [X] & && | || >> <<
- [X] ++ --
- [X] \+ \- ! ~
- [X] += -= *= /= ...
- [X]