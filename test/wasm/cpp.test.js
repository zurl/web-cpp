const {NoInputFile, CommandOutputFile} = require( "../../dist/runtime/vmfile");
const {JsAPIMap}= require("../../dist/library/index");

const {NativeRuntime} = require("../../dist/runtime/native_runtime");

const TestBase = require("./testbase");

const source = `
#include <stdio.h>
struct ABC{
    int a;
    int b;
    int c;
} d;
int main(){
    struct ABC i;
    int arr[100];
    i.a = 123;
    printf("%d\\n", i.a);
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
                "::printf": JsAPIMap.printf
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