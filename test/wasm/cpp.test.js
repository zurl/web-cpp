const {NoInputFile, CommandOutputFile} = require( "../../dist/runtime/vmfile");
const {JsAPIMap}= require("../../dist/library/index");

const {NativeRuntime} = require("../../dist/runtime/native_runtime");

const TestBase = require("./testbase");

const source = `
__libcall void putInt(int x);
#include <stdio.h>
int main(){
printf("%d,", 1+2-3*4);
printf("%.3lf,", 1.0+2.0-3.0*4.0/5.0);
printf("%d,", 22&33|44^55);
printf("%.3lf,", 1+4.0*8);
printf("%d,", 2<=3);
printf("%d,", 6%2);
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
                "@putInt": function(x){
                    console.log(x);
                },
                "@putChar": function(ctx){
                    console.log(String.fromCharCode(x));
                },
                "@printf": JsAPIMap.printf
            }
        };
        fs.writeFileSync('test.wasm', new Uint8Array(bin.binary));
        const runtime = new NativeRuntime(bin.binary, 10, importObj, [
            new NoInputFile(),
            new CommandOutputFile(),
            new CommandOutputFile()
        ]);
        return await runtime.run();
    });
});