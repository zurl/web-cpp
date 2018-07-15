/// <reference path="../../node_modules/@types/webassembly-js-api/index.d.ts" />

import {LinkerError} from "../common/error";
import {BinaryObject, CompiledObject} from "../common/object";
import {ImportObject} from "../runtime/runtime";
import {i32, u32, WASMEmitter, WConst, WFunction, WGlobalVariable, WImportFunction, WModule} from "../wasm";
import {printWNode} from "../wasm/tools";

import * as fs from "fs";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/07/2018
 */

export interface LinkOptions {
    debug?: boolean;
}

export function link(fileName: string, objects: CompiledObject[], option: LinkOptions): BinaryObject {

    const importObjects: string[] = [];
    const imports: WImportFunction[] = [];
    const functions: WFunction[] = [];
    const externVarMap: Map<string, number> = new Map<string, number>();

    // 1. set function dataStart
    let dataNow = 0;
    for (const object of objects) {
        for (const func of object.functions) {
            func.dataStart = dataNow;
            functions.push(func);
        }
        dataNow += object.dataSize;
    }

    // 2. build extern map

    for (const object of objects) {
        for (const symbol of object.exports) {
            const item = externVarMap.get(symbol.name);
            if ( item ) {
                throw new LinkerError(`duplicated symbol of ${symbol.name}`);
            }
            externVarMap.set(symbol.name, symbol.location);
        }
    }

    // 3. merge import obj
    for (const object of objects) {
        for (const item of object.imports) {
            if ( !importObjects.includes(item.name)) {
                importObjects.push(item.name);
                imports.push(new WImportFunction("js", item.name,
                    item.type.returnTypes, item.type.parameters));
            }
        }
    }

    // 4. merge scope map

    // TODO::

    // 5. generate target code
    const mod = new WModule({
        functions,
        imports,
        exports: ["@main"],
        globals: [
            new WGlobalVariable("$sp", u32, new WConst(u32, "1024")),
        ],
    });

    fs.writeFileSync("ast.wast", printWNode(mod), "utf-8");

    const emitter = new WASMEmitter();
    emitter.externMap = externVarMap;
    mod.emit(emitter);

    return {
        fileName,
        binary: emitter.buffer.slice(0, emitter.now),
    };
}
