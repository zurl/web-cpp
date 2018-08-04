/// <reference path="../../node_modules/@types/webassembly-js-api/index.d.ts" />

import {LinkerError} from "../common/error";
import {BinaryObject, CompiledObject, SourceMap} from "../common/object";
import {ImportObject} from "../runtime/runtime";
import {
    i32,
    u32,
    WASMEmitter,
    WCall,
    WConst,
    WFunction,
    WGlobalVariable,
    WImportFunction,
    WModule, WReturn,
    WType,
} from "../wasm";
import {printWNode} from "../wasm/tools";

import * as fs from "fs";
import {WGetGlobal, WGetLocal} from "../wasm/expression";
import {WDataSegment, WImportItem, WImportMemory} from "../wasm/section";
import {WSetGlobal} from "../wasm/statement";

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
    const imports: WImportItem[] = [];
    const functions: WFunction[] = [];
    const data: WDataSegment[] = [];
    const initFuncNames: string[] = [];
    const externVarMap = new Map<string, number>();
    const sourceMap = new Map<string, SourceMap>();
    const requiredFuncTypes = new Set<string>();

    // 0. construct sourceMap
    for (const object of objects) {
        sourceMap.set(object.fileName, {
            source: object.source!.split("\n"),
            sourceMap: object.sourceMap!,
            lastLine: 0,
        });
        Array.from(object.requiredWASMFuncTypes.keys())
            .map((x) => requiredFuncTypes.add(x));
    }

    const entry = [];

    // 1. set function dataStart && bssStart
    let dataNow = 0;
    for (const object of objects) {
        for (const func of object.functions) {
            func.dataStart = dataNow;
            if (/::main@.*/.test(func.name)) {
                entry.push(func.name);
            }
            functions.push(func);
        }
        data.push(new WDataSegment(dataNow, object.data.slice(0, object.dataSize)));
        const initFuncName = `$init$${object.fileName}`;
        const initFunc = new WFunction(initFuncName,
            [], [], [], object.globalStatements);
        initFunc.dataStart = dataNow;
        functions.push(initFunc);
        initFuncNames.push(initFuncName);
        dataNow += object.dataSize;
    }

    let bssNow = dataNow;
    for (const object of objects) {
        for (const func of object.functions) {
            func.bssStart = bssNow;
        }
        bssNow += object.dataSize;
    }

    const startFunc = new WFunction("$start", [], [], [],
        initFuncNames.map((name) => new WCall(name, [], [])));
    functions.push(startFunc);
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
                imports.push(new WImportFunction("system", item.name,
                    item.type.returnTypes, item.type.parameters));
            }
        }
    }

    // 4. merge scope map

    // TODO::

    // 5. add import memory

    imports.push(new WImportMemory("system", "memory", 1, 10));

    functions.push(new WFunction("$get_sp", [WType.u32], [], [], [
        new WReturn(new WGetGlobal(WType.u32,  "$sp")),
    ]));

    functions.push(new WFunction("$set_sp", [], [WType.u32], [], [
        new WSetGlobal(WType.u32,  "$sp", new WGetLocal(WType.u32, 0)),
    ]));

    if ( entry.length === 0) {
        throw new LinkerError(`no main function found`);
    }

    if (entry.length > 1) {
        throw new LinkerError(`multiple main function found`);
    }

    // 6. generate target code
    const mod = new WModule({
        functions,
        imports,
        exports: ["$start", entry[0], "$get_sp", "$set_sp"],
        globals: [
            new WGlobalVariable("$sp", u32, new WConst(u32, "1000")),
        ],
        data,
        generateMemory: false,
        requiredFuncTypes: Array.from(requiredFuncTypes.keys()),
    });

    //fs.writeFileSync("ast.wast", printWNode(mod), "utf-8");

    const emitter = new WASMEmitter();
    emitter.externMap = externVarMap;
    mod.optimize(emitter);
    mod.emit(emitter);

    if (option.debug) {
        const dumper = new WASMEmitter();
        dumper.sourceMap = sourceMap;
        mod.dump(dumper);
    }
    return {
        fileName,
        entry: entry[0],
        sourceMap,
        binary: emitter.buffer.slice(0, emitter.now),
    };
}
