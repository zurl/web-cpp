import {SourceMapGenerator} from "source-map";
import {Scope} from "../codegen/scope";
import {WFunction, WImportFunction} from "../wasm";
import {WMemoryLocation} from "../wasm/expression";
import {Type} from "./type";
import {ImportObject} from "../runtime/runtime";
import {WFunctionType} from "../wasm/section";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/07/2018
 */

export interface ExportSymbol {
    name: string;
    type: Type;
    form: WMemoryLocation;
    location: number;
}

export interface ImportSymbol {
    name: string;
    type: WFunctionType;
}

export interface CompiledObject {
    fileName: string;
    dataSize: number;
    functions: WFunction[];
    imports: ImportSymbol[];
    exports: ExportSymbol[];

    // debug only
    scopeMap?: Map<string, Scope>;
    source?: string;
    sourceMap?: SourceMapGenerator;
}

export interface BinaryObject {
    fileName: string;
    binary: ArrayBuffer;

    // debug only
    scopeMap?: Map<string, Scope>;
}
