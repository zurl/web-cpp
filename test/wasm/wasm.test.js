const {
    WCodeSection, WFunction, WModule, WLoad,
    F32Binary, F32Const, WReturn, WImportFunction,
    F32Unary,
    F64Binary, F64Const, WCall, WGlobalVariable,
    F64Unary,
    I32Binary, I32Const,
    I32Unary,
    I64Binary, I64Const, WASMEmitter,
    I64Unary, U32Memory, U64Memory, WType,
    WStore, WConst, WBinaryOperation, BinaryOperator, UnaryOperator,
    i32, i64, f32, f64
}
    = require("../../dist/wasm/index");
const {SourceLocation, Position} = require("../../dist/common/ast");
const fs = require('fs');
describe('wasm', function () {
    it('should works', async function () {
        const _ = new SourceLocation("", new Position(0, 0, 0), new Position(0, 0, 0));
        const ins = [
            new WStore(i32,
                new WConst(i32, '123'),
                new WBinaryOperation(
                    I32Binary.add,
                    new WLoad(i32, new WConst(i32, '123')),
                    new WConst(i32, '123')
                )),
            new WCall("print", [new WConst(i32, '123')]),
            new WReturn(new WConst(i32, '123'))
        ];
        const mod = new WModule({
            functions: [
                new WFunction("main", [i32], [i32], [i32], ins)
            ],
            imports: [
                new WImportFunction("js", "print", [], [i32])
            ],
            exports: ["main"],
            globals: [
                new WGlobalVariable("$sp", i32, new WConst(i32, '0')),
                new WGlobalVariable("$bp", i32, new WConst(i32, '0')),
            ]
        });
        const emitter = new WASMEmitter();
        mod.emit(emitter);
        fs.writeFileSync('test.wasm', new Uint8Array(emitter.buffer.slice(0, emitter.now)));

        const importObj = {
            js: {
                print: (x) => {
                    console.log("hello, World: " + x)
                }
            }
        };

        const asm = await WebAssembly.instantiate(emitter.buffer.slice(0, emitter.now), importObj);
        asm.instance.exports.main();
    })
});