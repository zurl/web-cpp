/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 09/07/2018
 */

import {Buffer} from "buffer";
import {readFileSync, writeFileSync} from "fs";
import {codegen} from "../codegen";
import {CompileContext} from "../codegen/context";
import {BinaryObject} from "../common/object";
import {Impls, JsAPIMap} from "../library";
import {link} from "../linker";
import {CParser} from "../parser";
import {preprocess} from "../preprocessor";
import {NativeRuntime} from "../runtime/native_runtime";
import {CommandOutputFile, NoInputFile, StringOutputFile} from "../runtime/vmfile";

const BINARY_VERSION = 3;

export function saveBinaryFile(fileName: string, binary: BinaryObject) {
    const codeBuf = Buffer.from(binary.binary);
    const code = codeBuf.toString("base64");
    writeFileSync(fileName, JSON.stringify({
        version: BINARY_VERSION,
        enrty: binary.entry,
        code,
    }));
}

export function loadBinaryFile(fileName: string): BinaryObject {
    const json = JSON.parse(readFileSync(fileName, "utf-8"));
    const {entry} = json;
    const binary = Buffer.from(json.code, "base64") as any;
    return {
        binary,
        entry,
        fileName,
    };
}

function compile(name: string, source: string, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code, {});
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}

function precompileLibrarys() {
    const objects = [];
    for (const impl of Impls.keys()) {
        const obj = compile(impl, Impls.get(impl)!);
        objects.push(obj);
    }
    return objects;
}

//const LibraryObjects = precompileLibrarys();

export function compileFile(sourceFileName: string): BinaryObject {
    const source = readFileSync(sourceFileName, "utf-8");
    const object = compile(sourceFileName, source);
    const binary = link("main.cpp", [object], {});
    return binary;
}

export function runFile(bin: BinaryObject, memorySize: number) {
    const importObj: any = {system: {}};
    for (const key of Object.keys(JsAPIMap)) {
        importObj["system"]["::" + key] = JsAPIMap[key];
    }
    const runtime = new NativeRuntime(bin.binary, 10, bin.entry, importObj, [
        new NoInputFile(),
        new CommandOutputFile(),
        new CommandOutputFile(),
    ]);
    runtime.run();
}
