import {OpCodes, WASMJSON, WFunctionType, WType} from "..";
import {EmptyLocation} from "../../common/node";
import {SourceMap} from "../../common/object";

// Web-cpp WASM dumper
function getIndent(x: number): string {
    let result = "";
    for (let i = 0; i < x; i++) {
        result += " ";
    }
    return result;
}
const memory_type = ["RAW", "DATA", "BSS", "EXTERN"];
export function dumpWASMJSON(json: WASMJSON, source: Map<string, SourceMap>): string {
    let str = "";
    let indent = 0;
    let indentstr = "";
    for (const func of json.functions) {
        const memoryInfo = new Map<number, [number, number]>();
        func.memoryInfo.map((x) => memoryInfo.set(x[0], [x[1], x[2]]));
        const sourceMap = source.get(func.fileName);
        let nowSourceLine = func.sourceRange[0] - 1;
        const type = WFunctionType.fromEncoding(func.type, EmptyLocation);
        str += `func ${func.name} (param ${type.parameters.map((x) => WType[x])})`;
        str += `(ret ${type.returnTypes.map((x) => WType[x])}) (\n`;
        indent += 1; indentstr = getIndent(indent);
        str += indentstr + `(locals ${func.locals.map((x) => WType[x])})\n`;
        for (let i = 0; i < func.codes.length; i++) {
            const ins = func.codes[i];
            if (func.fileName && sourceMap) {
                while (nowSourceLine <= func.sourceRange[1] && nowSourceLine <= ins[2]) {
                    str += "# " + sourceMap.source[nowSourceLine++] + "\n";
                }
            }
            let opcode = OpCodes.get(ins[0]);
            const item = memoryInfo.get(i + 1);
            if (item) {
                opcode += `(${memory_type[item[0]]}, ${item[1]})`;
            }
            str += indentstr + `${opcode} ${ins[1]}\n`;
        }
        if (func.fileName && sourceMap) {
            while (nowSourceLine <= func.sourceRange[1]) {
                str += "# " + sourceMap.source[nowSourceLine++] + "\n";
            }
        }
        str += ")\n";
        indent -= 1; indentstr = getIndent(indent);
    }
    return str;
}
