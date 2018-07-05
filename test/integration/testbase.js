const {fromBytesToString} = require( "../../dist/common/utils");
const CodeGenTestBase = require("../codegen/testbase");
const {VirtualMachine} = require("../../dist/vm/index");
const TestRunScopeMap = CodeGenTestBase.mergeScopeMap([
    CodeGenTestBase.HeaderScopeMap,
    CodeGenTestBase.compile("testrun.h", `
    __libcall void print(int a);
    __libcall void puts(void *str);
`).scopeMap]
);

function testRun(source, debug){
    let options = {};
    if(debug) options = {debugMode: true};
    let result = "";
    const print = (vm) => {
        result += vm.popInt32() + "\n";
    };
    const puts = (vm) =>{
        result += fromBytesToString(vm.memory, vm.popUint32()) + "\n";
    };
    const obj = CodeGenTestBase.compile('main.cpp', source, TestRunScopeMap, options);
    const bin = CodeGenTestBase.components.Linker.link([obj],
        {
            ...CodeGenTestBase.JsAPIMap,
            print,
            puts
        }, options);
    if(debug) {
        CodeGenTestBase.showASM(source, bin);

    }
    const memoryBuffer = new ArrayBuffer(10000);
    const memory = new DataView(memoryBuffer);
    const memoryArray = new Uint8Array(memoryBuffer);
    memoryArray.set(new Uint8Array(bin.code.buffer), 0);
    const vm = new VirtualMachine(memory, bin.jsAPIList);
    let i = 0;
    while( i < 100000 ){
        const ret = vm.runOneStep();
        if(!ret) return result;
    }
    throw "code run too much";
}

module.exports = {
    testRun
};