/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {Node} from "../common/ast"

import {Type} from "../common/type";
import {MemoryLayout} from "./memory";
import {Assembly, InstructionBuilder, OpCode} from "./instruction";
import {InternalError} from "../common/error";
import {FunctionEntity, Scope} from "./scope";
interface CompileOptions {
    debugMode?: boolean;
    experimentalCpp?: boolean;
    eliminateConstantVariable?: boolean;
}

export class CompileContext {
    scopeMap: Map<string, Scope>;
    functionMap: Map<string, FunctionEntity>;
    currentFunction: FunctionEntity | null;
    currentScope: Scope;
    memory: MemoryLayout;

    currentNode: Node | null;
    globalBuilder: InstructionBuilder;
    currentBuilder: InstructionBuilder | null;
    options: CompileOptions;
    fileName: string;

    constructor(fileName: string, compileOptions: CompileOptions = {}) {
        this.functionMap = new Map<string, FunctionEntity>();
        this.scopeMap = new Map<string, Scope>();
        this.memory = new MemoryLayout(1000);
        this.currentFunction = null;
        this.currentScope = new Scope("@root", null);
        this.currentScope.isRoot = true;
        this.scopeMap.set(this.currentScope.getScopeName(), this.currentScope);
        this.globalBuilder = new InstructionBuilder(1024);
        this.currentBuilder = null;
        this.options = compileOptions;
        this.fileName = fileName;
        this.currentNode = null;
    }

    enterScope(name: string | null) {
        if (name === null) {
            name = this.currentScope.children.length.toString();
        }
        const scope = this.scopeMap.get(this.currentScope.getScopeName() + "@" + name);
        if (scope != null) {
            this.currentScope = scope;
        }
        else {
            this.currentScope = new Scope(name, this.currentScope);
            if( this.currentScope.parent != null){
                this.currentScope.parent.children.push(this.currentScope);
            }
            this.scopeMap.set(this.currentScope.getScopeName(), this.currentScope);
        }
    }

    exitScope() {
        if (this.currentScope.parent != null) {
            this.currentScope = this.currentScope.parent;
        }
    }

    enterFunction(name: string, functionEntity: FunctionEntity) {
        this.functionMap.set(name, functionEntity);
        this.currentScope.set(name, functionEntity);
        this.enterScope(name);
        this.memory.enterFunction();
        this.currentBuilder = new InstructionBuilder(1024);
        this.currentFunction = functionEntity;
    }

    exitFunction() {
        if (this.currentFunction == null) throw new InternalError(`this.currentFunction==null`);
        if (this.currentBuilder == null) throw new InternalError(`this.currentBuilder==null`);
        this.currentFunction.code = this.currentBuilder.toAssembly();
        //this.currentFunction = null;
        //this.currentBuilder = null;
        this.exitScope();
    }

    unresolve(name: string) {
        if (this.currentBuilder == null) throw new InternalError(`this.currentBuilder==null`);
        this.currentBuilder.unresolve(name);
    }

    build(op: OpCode, imm?: string | number) {
        if (this.currentBuilder == null || this.currentNode == null) throw new InternalError(`this.currentBuilder==null|| this.currentNode == null`);
        this.currentBuilder.build(this.currentNode.location.start.line, op, imm);
    }

    get buildNow(): number {
        if (this.currentBuilder == null) throw new InternalError(`this.currentBuilder==null`);
        return this.currentBuilder.now;
    }


    // only call once
    toCompiledObject(): CompiledObject {
        const size = Array.from(this.functionMap.values())
            .filter(func => func.code !== null)
            .map(func => (func.code as Assembly).size)
            .reduce((x, y) => x + y);
        const resultBuffer = new ArrayBuffer(size);
        const code = new DataView(resultBuffer);
        const resultArray = new Uint8Array(resultBuffer);
        const unresolvedSymbols = [] as [number, string][];
        const labels = [] as [number, string][];
        const sourceMap = [] as [number, number][];
        let curSize = 0;
        for (let func of this.functionMap.values()) {
            labels.push([curSize, func.name]);
            if (func.code === null) continue;
            resultArray.set(new Uint8Array(func.code.code.buffer.slice(0, func.code.size)), curSize);
            for (let item of func.code.unresolvedSymbols) {
                unresolvedSymbols.push([item[0] + curSize, item[1]]);
            }
            if(this.options.debugMode){
                for(let item of func.code.sourceMap){
                    sourceMap.push([item[0] + curSize, item[1]])
                }
            }
            func.location = curSize;
            curSize += func.code.size;
            func.code = null; // free memory
        }
        return {
            fileName: this.fileName,
            assembly: {
                size,
                code,
                unresolvedSymbols,
                sourceMap
            },
            globalAssembly: this.globalBuilder.toAssembly(),
            scopeMap: this.scopeMap,
            dataSize: this.memory.dataPtr,
            bssSize: this.memory.bssPtr,
            labels: labels
        }
    }
}


export interface CompiledObject {
    fileName: string;
    dataSize: number;
    bssSize: number;
    globalAssembly: Assembly;
    assembly: Assembly;
    scopeMap: Map<string, Scope>;
    labels: [number, string][];
}
