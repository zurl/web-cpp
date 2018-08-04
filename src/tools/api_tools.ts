import {codegen} from "../codegen";
import {CompileContext} from "../codegen/context";
import {BinaryObject} from "../common/object";
import {Impls, JsAPIMap} from "../library";
import {link} from "../linker";
import {CParser} from "../parser";
import {preprocess} from "../preprocessor";
import {CallbackOutputFile} from "../runtime/vmfile";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 04/08/2018
 */

function compile(name: string, source: string, options = {}) {
    const {code, map} = preprocess(name, source);
    const translationUnit = CParser.parse(code, options);
    const ctx = new CompileContext(name, options, source, map);
    codegen(translationUnit, ctx);
    return ctx.toCompiledObject();
}
const precompiledObjects = Array.from(Impls.keys()).map((x) => compile(x, Impls.get(x)!, {isCpp: true}));

// const LibraryObjects = precompileLibrarys();

export function compileFile(sourceFileName: string, source: string): BinaryObject {
    const object = compile(sourceFileName, source, {isCpp: true});
    const binary = link("main.cpp", [...precompiledObjects, object], {});
    return binary;
}

export const importObj: any = {system: {}};
for (const key of Object.keys(JsAPIMap)) {
    importObj["system"]["::" + key] = JsAPIMap[key];
}

export {NativeRuntime} from "../runtime/native_runtime";
export {VMFile, StringOutputFile, CallbackOutputFile, NoInputFile} from "../runtime/vmfile";