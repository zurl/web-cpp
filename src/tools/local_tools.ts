/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 09/07/2018
 */

import {Buffer} from "buffer";
import {readFileSync, writeFileSync} from "fs";
import {codegen} from "../codegen";
import {CompileContext} from "../codegen/context";
import {Scope} from "../codegen/scope";
import {BinaryObject} from "../common/object";
import {Impls, JsAPIMap} from "../library";
import {link} from "../linker";
import {CParser} from "../parser";
import {preprocess} from "../preprocessor";
import {NativeRuntime} from "../runtime/native_runtime";
import {CommandOutputFile, NoInputFile  } from "../runtime/vmfile";

const BINARY_VERSION = 3;

export function saveBinaryFile(fileName: string, binary: BinaryObject) {
    const codeBuf = Buffer.from(binary.binary);
    const code = codeBuf.toString("base64");
    const json = binary.json;
    writeFileSync(fileName, JSON.stringify({
        version: BINARY_VERSION,
        enrty: binary.entry,
        heapStart: binary.heapStart,
        code,
        json,
    }));
}

export function loadBinaryFile(fileName: string): BinaryObject {
    const orijson = JSON.parse(readFileSync(fileName, "utf-8"));
    const {entry, heapStart, json} = orijson;
    const binary = Buffer.from(orijson.code, "base64") as any;
    return {
        binary,
        entry,
        heapStart,
        fileName,
        json,
        dumpInfo: "",
        scope: new Scope("", null, true),
    };
}

function compile(name: string, source: string, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code, options);
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}
const precompiledObjects = Array.from(Impls.keys()).map((x) => compile(x, Impls.get(x)!, {isCpp: true}));

// const LibraryObjects = precompileLibrarys();

export function compileFile(sourceFileName: string): BinaryObject {
    const source = readFileSync(sourceFileName, "utf-8");
    const object = compile(sourceFileName, source, {isCpp: true});
    const binary = link("main.cpp", [...precompiledObjects, object], {});
    return binary;
}

export function runFile(bin: BinaryObject, memorySize: number) {
    const importObj: any = {system: {}};
    for (const key of Object.keys(JsAPIMap)) {
        importObj["system"]["::" + key] = JsAPIMap[key];
    }
    const runtime = new NativeRuntime({
            importObjects: importObj,
            code: bin.binary,
            memorySize: 10,
            entry: bin.entry,
            heapStart: bin.heapStart,
            files: [
                new NoInputFile(),
                new CommandOutputFile(),
                new CommandOutputFile(),
            ],
        });
    runtime.run();
}
