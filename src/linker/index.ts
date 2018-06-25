/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 18/06/2018
 */
import {CompiledObject} from "../codegen/context";
import {Type} from "../common/type";
import {FunctionEntity, Scope, Variable, VariableStorageType} from "../codegen/scope";
import {OpCode, OpCodeLimit} from "../codegen/instruction";
import {LinkerError} from "../common/error";

interface LinkOptions {
    debugMode?: boolean;
}

export interface BinaryObject {
    code: DataView;
    dataStart: number;
    bssSize: number;
    labelMap: Map<number, string>;
    sourceMap: Map<number, [string, number]>;
}

function resolveSymbol(path: string, scopeMap: Map<string, Scope>): Variable | FunctionEntity {
    const tokens = path.split("@");
    const scopeName = tokens.slice(0, tokens.length - 1).join('@');
    const name = tokens[tokens.length - 1];
    const scope = scopeMap.get(scopeName);
    if (scope === undefined) {
        throw new LinkerError(`undefined symbol ${name} at ${path}`);
    }
    const item = scope.getInCurrentScope(name);
    if (item === null) {
        throw new LinkerError(`undefined symbol ${name} at ${path}`);
    }
    if (item instanceof Type){
        throw new LinkerError(`symbol ${name} is a type....`);
    }
    if (item instanceof Variable && item.storageType === VariableStorageType.MEMORY_EXTERN){
        throw new LinkerError(`no definition for symbol ${name} at ${path}`);
    }
    return item;
}

function mergeScopeTo(dst: Scope, src: Scope) {
    for (const tuple of src.map.entries()) {
        const dstval = dst.map.get(tuple[0]);
        if (dstval === undefined) {
            dst.map.set(tuple[0], tuple[1]);
        }
        else {
            const srcval = tuple[1];
            if (srcval instanceof FunctionEntity
                && dstval instanceof FunctionEntity
                && srcval.type.equals(dstval.type)) {
                if (srcval.code === null && dstval.code === null) continue;
                if (srcval.code !== null && dstval.code === null) {
                    dst.map.set(tuple[0], tuple[1]);
                }
                if (srcval.code === null && dstval.code !== null) continue;
                if (srcval.code !== null && dstval.code !== null) {
                    throw new LinkerError(`Duplicated Definition of ${srcval.name}`);
                }
            }
            if (srcval instanceof Variable
                && dstval instanceof Variable
                && srcval.type.equals(dstval.type)) {
                if (srcval.storageType === VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType === VariableStorageType.MEMORY_EXTERN) continue;
                if (srcval.storageType !== VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType === VariableStorageType.MEMORY_EXTERN) {
                    dst.map.set(tuple[0], tuple[1]);
                }
                if (srcval.storageType === VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType !== VariableStorageType.MEMORY_EXTERN) continue;
                if (srcval.storageType !== VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType !== VariableStorageType.MEMORY_EXTERN) {
                    throw new LinkerError(`Duplicated Definition of ${srcval.name}`);
                }
            }

            throw new LinkerError(`Different definition of ${srcval.toString()} and  ${dstval.toString()}`);
        }
    }
}

function mergeScopeMap(scopeMaps: Map<string, Scope>[]): Map<string, Scope> {
    const result = new Map<string, Scope>();
    for (const scopeMap of scopeMaps) {
        for (const tuple of scopeMap.entries()) {
            const item = result.get(tuple[0]);
            if (item === undefined) {
                result.set(tuple[0], tuple[1]);
            }
            else {
                mergeScopeTo(item, tuple[1]);
            }
        }
    }
    return result;
}


function shiftMemoryOffset(code: DataView, codeOffset: number, codeLength: number,
                           dataOffset: number, bssOffset: number) {
    let i = codeOffset;
    while (i < codeOffset + codeLength) {
        const op = code.getUint8(i);
        if( op === OpCode.JAL){
            const val = code.getUint32(i + 1);
            code.setUint32(i + 1,  val + codeOffset);
            i += 5;
        }
        else if( op === OpCode.LDATA){
            const val = code.getUint32(i + 1);
            code.setUint32(i + 1,  val + dataOffset);
            i += 5;
        }
        else if (op === OpCode.LBSS) {
            const val = code.getUint32(i + 1);
            code.setUint32(i + 1,  val + bssOffset);
            i += 5;
        }
        else if (op <= OpCodeLimit.L1) {
            i += 1;
        }
        else if (op <= OpCodeLimit.L5U) {
            i += 5;
        }
        else if (op <= OpCodeLimit.L5I) {
            i += 5;
        }
        else if (op === OpCode.LF64) {
            i += 9;
        }
        else{
            throw new LinkerError(`unknown ins`);
        }
    }
}

/**
 * The C/C++ Linker
 *
 * 1. compare the unresolved symbol;
 * 2. resolve unresolved function call (JAL)
 * 3. resolve unresolved variables (extern memory)
 * 4. adjust inner global memory reference (LM, LMP, SM, SMP)
 * 5. merge into one code buffer;
 * 6. select the code entry point: main
 *
 * @param {CompiledObject[]} inputs
 * @param {LinkOptions} linkOptions
 * @returns {BinaryObject}
 */
export function link(inputs: CompiledObject[], linkOptions : LinkOptions = {}): BinaryObject {
    // merge Scope
    const scopeMaps = inputs.map(input => input.scopeMap);
    const newScope = mergeScopeMap(scopeMaps);

    // merge code
    let [globalCodeSize, codeSize, dataSize, bssSize] = inputs
        .map(input => [input.globalAssembly.size, input.assembly.size, input.dataSize, input.bssSize])
        .reduce((x, y) => x.map((_, i)=> x[i] + y[i]));

    globalCodeSize += 6; // 6 for JAL MAIN; END

    const codeBuffer = new ArrayBuffer(globalCodeSize + codeSize + dataSize);
    const code = new DataView(codeBuffer);
    const codeArray = new Uint8Array(codeBuffer);

    const bssLocMap = new Map<string, number>();
    const dataLocMap = new Map<string, number>();
    const codeLocMap = new Map<string, number>();
    const labelMap = new Map<number, string>();
    const sourceMap = new Map<number, [string, number]>();



    let globalCodeNow = 0;
    let codeNow = globalCodeSize;
    let dataNow = globalCodeSize + codeSize;
    let bssNow = globalCodeSize + codeSize + dataSize;


    // 1. compute offset
    for (const input of inputs) {
        if( dataLocMap.get(input.fileName) !== undefined){
            throw new LinkerError(`duplicated file name ${input.fileName}`);
        }
        dataLocMap.set(input.fileName, dataNow);
        codeLocMap.set(input.fileName, codeNow);
        bssLocMap.set(input.fileName, bssNow);
        codeNow += input.assembly.size;
        dataNow += input.dataSize;
        bssNow += input.bssSize;
    }

    globalCodeNow = 0;
    dataNow = globalCodeSize + codeSize;
    bssNow = globalCodeSize + codeSize + dataSize;

    // 2. link global assembly
    for (const input of inputs) {
        codeArray.set(new Uint8Array(input.globalAssembly.code.buffer
            .slice(0, input.globalAssembly.size)), globalCodeNow);
        for (let tuple of input.globalAssembly.unresolvedSymbols) {
            const symbol = resolveSymbol(tuple[1], newScope);
            if(symbol instanceof FunctionEntity){
                code.setUint32(globalCodeNow + tuple[0] + 1, symbol.location as number
                    + (codeLocMap.get(symbol.fileName) as number) - codeNow);
            }
            else if(symbol.storageType == VariableStorageType.MEMORY_DATA){
                code.setUint32(globalCodeNow + tuple[0] + 1, symbol.location as number
                    + (dataLocMap.get(symbol.fileName) as number) - dataNow);
            }
            else if(symbol.storageType == VariableStorageType.MEMORY_BSS){
                code.setUint8(globalCodeNow + tuple[0], OpCode.LBSS);
                code.setUint32(globalCodeNow + tuple[0] + 1, symbol.location as number
                    + (bssLocMap.get(symbol.fileName) as number) - bssNow);
            }
            else{
                throw new LinkerError(`unknown symbol storage type`)
            }
        }
        shiftMemoryOffset(code, globalCodeNow, input.globalAssembly.size, dataNow, bssNow);
        globalCodeNow += input.globalAssembly.size;
        dataNow += input.dataSize;
        bssNow += input.bssSize;
    }

    codeNow = globalCodeSize;
    dataNow = globalCodeSize + codeSize;
    bssNow = globalCodeSize + codeSize + dataSize;

    // 3. link function assembly
    for (const input of inputs) {
        if(linkOptions.debugMode){
            for(const item of input.assembly.sourceMap){
                sourceMap.set(item[0] + codeNow, [input.fileName, item[1]]);
            }
        }
        for(const item of input.labels){
            labelMap.set(codeNow + item[0], item[1]);
        }
        codeArray.set(new Uint8Array(input.assembly.code.buffer
            .slice(0, input.assembly.size)), codeNow);
        for (let tuple of input.assembly.unresolvedSymbols) {
            const symbol = resolveSymbol(tuple[1], newScope);
            if(symbol instanceof FunctionEntity){
                code.setUint32(codeNow + tuple[0] + 1, symbol.location as number
                    + (codeLocMap.get(symbol.fileName) as number) - codeNow);
            }
            else if(symbol.storageType == VariableStorageType.MEMORY_DATA){
                code.setUint32(codeNow + tuple[0] + 1, symbol.location as number
                    + (dataLocMap.get(symbol.fileName) as number) - dataNow);
            }
            else if(symbol.storageType == VariableStorageType.MEMORY_BSS){
                code.setUint8(codeNow + tuple[0], OpCode.LBSS);
                code.setUint32(codeNow + tuple[0] + 1, symbol.location as number
                    + (bssLocMap.get(symbol.fileName) as number) - bssNow);
            }
            else{
                throw new LinkerError(`unknown symbol storage type`)
            }
        }
        shiftMemoryOffset(code, codeNow, input.assembly.size, dataNow, bssNow);
        codeNow += input.assembly.size;
        dataNow += input.dataSize;
        bssNow += input.bssSize;
    }
    // 3. TODO:: data default to be empty

    // 4. inject bootstrap instruction;

    const entry = resolveSymbol("@root@main", newScope);
    const entryLoc = (codeLocMap.get(entry.fileName) as number) + (entry.location as number);
    // JAL main
    // END
    code.setUint8(globalCodeSize - 6, OpCode.JAL);
    code.setUint32(globalCodeSize - 5, entryLoc);
    code.setUint8(globalCodeSize - 1, OpCode.END);

    return {
        code,
        labelMap,
        sourceMap,
        dataStart: codeSize,
        bssSize: bssSize
    };
}