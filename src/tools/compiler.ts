import {SourceMapConsumer} from "source-map";
import {codegen} from "../codegen";
import {CompileContext} from "../codegen/context";
import {CompilerError, PreprocessError} from "../common/error";
import {BinaryObject} from "../common/object";
import {Impls, JsAPIMap} from "../library";
import {link} from "../linker";
import {CParser} from "../parser";
import {preprocess} from "../preprocessor";
import {CallbackOutputFile, StringInputFile} from "../runtime/vmfile";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 04/08/2018
 */

function compile(name: string, source: string, options: any = {}) {
    options.fileName = name;
    const {code, map} = preprocess(name, source);
    try {
        const translationUnit = CParser.parse(code, options);
        const ctx = new CompileContext(name, options, source, map);
        codegen(translationUnit, ctx);
        return ctx.toCompiledObject();
    } catch (e) {
        const sm = new SourceMapConsumer(map.toString());
        if (e instanceof CompilerError) {
            const newStart = sm.originalPositionFor(e.location.start);
            e.errorLine = source.split("\n")[newStart.line];
            e.location.start.line = newStart.line;
            e.location.start.column = newStart.column;
        }
        throw e;
    }
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

export {CompilerError} from "../common/error";
export {NativeRuntime} from "../runtime/native_runtime";
export {VMFile, StringOutputFile, StringInputFile, CallbackOutputFile, NoInputFile} from "../runtime/vmfile";
