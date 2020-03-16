/// <reference path="../../node_modules/@types/webassembly-js-api/index.d.ts" />

import {LinkerError} from "../common/error";
import {EmptyLocation} from "../common/node";
import {BinaryObject, CompiledObject, SourceMap} from "../common/object";
import {ImportObject} from "../runtime/runtime";
import {
    i32, JSONEmitter,
    u32,
    WASMEmitter,
    WCall,
    WConst, WDataSegment,
    WFunction, WGetGlobal, WGetLocal,
    WGlobalVariable,
    WImportFunction, WImportItem, WImportMemory,
    WModule, WReturn, WSetGlobal,
    WType,
} from "../wasm";
import {dumpWASMJSON} from "../wasm/tool/dumper";

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
            func.fileName = object.fileName;
            if (/^::main@.*/.test(func.name)) {
                entry.push(func.name);
            }
            functions.push(func);
        }
        data.push(new WDataSegment(dataNow, object.data.slice(0, object.dataSize), EmptyLocation));
        const initFuncName = `$init$${object.fileName}`;
        const initFunc = new WFunction(initFuncName, initFuncName,
            [], [], [], object.globalStatements, EmptyLocation);
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

    const startFunc = new WFunction("$start", "__start", [], [], [],
        initFuncNames.map((name) => new WCall(name, [], [], EmptyLocation)), EmptyLocation);
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
                    item.type.returnTypes, item.type.parameters, EmptyLocation));
            }
        }
    }

    // 4. merge scope map

    // Nope, we use only the main scope
    const scope = objects[objects.length - 1].scope;

    // 5. add import memory

    imports.push(new WImportMemory("system", "memory", 1, 10, EmptyLocation));

    functions.push(new WFunction("$get_sp", "get_sp", [WType.u32], [], [], [
        new WReturn(new WGetGlobal(WType.u32,  "$sp", EmptyLocation), EmptyLocation),
    ], EmptyLocation));

    functions.push(new WFunction("$set_sp", "set_sp", [], [WType.u32], [], [
        new WSetGlobal(WType.u32,  "$sp", new WGetLocal(WType.u32, 0, EmptyLocation), EmptyLocation),
    ], EmptyLocation));

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
            new WGlobalVariable("$sp", u32, new WConst(u32, "1000", EmptyLocation), EmptyLocation),
        ],
        data,
        generateMemory: false,
        requiredFuncTypes: Array.from(requiredFuncTypes.keys()),
    }, EmptyLocation);

    // fs.writeFileSync("ast.wast", printWNode(mod), "utf-8");

    const emitter = new WASMEmitter(externVarMap, sourceMap);
    mod.optimize(emitter);
    mod.emit(emitter);

    const jsonEmitter = new JSONEmitter(externVarMap, sourceMap);
    mod.optimize(jsonEmitter);
    mod.emit(jsonEmitter);

    let dumpInfo = "";
    if (option.debug) {
        dumpInfo = dumpWASMJSON(jsonEmitter.getJSON(), sourceMap);
    }

    const heapStart = (parseInt((bssNow + 1) / 4 as any) + 1) * 4;
    return {
        fileName,
        heapStart,
        entry: entry[0],
        sourceMap,
        scope,
        binary: emitter.toArrayBuffer(),
        json: jsonEmitter.getJSON(),
        dumpInfo,
    };
}
