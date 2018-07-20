/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 09/07/2018
 */

import {Buffer} from "buffer";
import {readFileSync, writeFileSync} from "fs";
import {codegen} from "../codegen";
import {CompileContext} from "../codegen/context";
import {Impls, JsAPIMap} from "../library";
import {link} from "../linker";
import {CParser} from "../parser";
import {preprocess} from "../preprocessor";
import {CommandOutputFile, NoInputFile} from "../runtime/vmfile";
import {BinaryObject} from "../common/object";

const BINARY_VERSION = 3;

export function saveBinaryFile(fileName: string, binary: BinaryObject) {
    const codeBuf = Buffer.from(binary.code.buffer);
    const code = codeBuf.toString("base64");
    writeFileSync(fileName, JSON.stringify({
        version: BINARY_VERSION,
        codeSize: binary.codeSize,
        dataSize: binary.dataSize,
        bssSize: binary.bssSize,
        code,
    }));
}

export function loadBinaryFile(fileName: string): BinaryObject {
    const json = JSON.parse(readFileSync(fileName, "utf-8"));
    const {dataSize, codeSize, bssSize} = json;
    const buffer = Buffer.from(json.code, "base64") as any;
    const code = new DataView(new Uint8Array(buffer).buffer);
    const jsAPIList = [];
    for (const key of Object.keys(JsAPIMap)) {
        jsAPIList.push(JsAPIMap[key]);
    }
    return {
        code,
        dataSize,
        codeSize,
        bssSize,
        jsAPIList,
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

const LibraryObjects = precompileLibrarys();

export function compileFile(sourceFileName: string): BinaryObject {
    const source = readFileSync(sourceFileName, "utf-8");
    const object = compile(sourceFileName, source);
    const binary = link([object, ...LibraryObjects], JsAPIMap, {});
    return binary;
}

export function runFile(binary: BinaryObject, memorySize: number) {
    const memoryBuffer = new ArrayBuffer(memorySize);
    const memory = new DataView(memoryBuffer);
    const memoryArray = new Uint8Array(memoryBuffer);
    memoryArray.set(new Uint8Array(binary.code.buffer), 0);
    const vm = new VirtualMachine({
        memory,
        heapStart: binary.code.buffer.byteLength + binary.bssSize,
        jsAPIList: binary.jsAPIList,
        files: [
            new NoInputFile(),
            new CommandOutputFile(),
            new CommandOutputFile(),
        ],
    });
    const i = 0;
    while ( i < 100000 ) {
        const ret = vm.runOneStep();
        if (!ret) { return 0; }
    }
    throw new Error("code run too much");
}
