const {NoInputFile, CommandOutputFile} = require( "../../dist/runtime/vmfile");
const {JsAPIMap}= require("../../dist/library/index");

const {NativeRuntime} = require("../../dist/runtime/native_runtime");

const TestBase = require("./testbase");

const source = `
#include <stdio.h>

int main(){
    int a = 10;
    switch(a){
        case 1: printf("1\\n"); break;
        case 2: printf("2\\n"); break;
        case 3: printf("3\\n"); break;
        default: printf("default\\n"); break;
    }
    return 0;
}
`;
const fs = require('fs');
describe('cpp -> wasm', function () {
    it('should works', async function () {
        const obj = TestBase.compile("main.cpp", source);
        const bin = TestBase.Linker.link("main", [obj], {});
        const importObj = {
            system: {
                "::putInt": function(x){
                    console.log(x);
                },
                "::putChar": function(ctx){
                    console.log(String.fromCharCode(x));
                },
                "::printf": JsAPIMap.printf,
                "::memcpy": JsAPIMap.memcpy,
            }
        };
        fs.writeFileSync('test.wasm', new Uint8Array(bin.binary));
        const runtime = new NativeRuntime(bin.binary, 10, bin.entry, importObj, [
            new NoInputFile(),
            new CommandOutputFile(),
            new CommandOutputFile()
        ]);
        return await runtime.run();
    });
});