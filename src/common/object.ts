import {SourceMapGenerator} from "source-map";
import {Scope} from "../codegen/scope";
import {WFunction, WImportFunction} from "../wasm";
import {WMemoryLocation} from "../wasm/expression";
import {Type} from "./type";
import {ImportObject} from "../runtime/runtime";

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

export interface CompiledObject {
    fileName: string;
    dataSize: number;
    function: Function[];
    imports: ImportObject[];
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
