const TestBase = require("./testbase");

const source = `

__libcall void putInt(int x);

int main(){
    int b = 1;
    for(int i = 0; i < 10; i++){
        b += i;
        putInt(b);
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
            js: {
                "@putInt": function(x){
                    console.log(x);
                }
            }
        };
        fs.writeFileSync('test.wasm', new Uint8Array(bin.binary));
        const asm = await WebAssembly.instantiate(bin.binary, importObj);
        asm.instance.exports["@main"]();
    });
});