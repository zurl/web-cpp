/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {RawSourceMap, SourceMapGenerator} from "source-map";
import {Node} from "../common/ast";
import {InternalError} from "../common/error";
import {Assembly, InstructionBuilder, OpCode} from "../common/instruction";
import {FunctionEntity} from "../common/type";
import {MemoryLayout} from "./memory";
import {Scope} from "./scope";

export interface CompiledObject {
    fileName: string;
    data: DataView;
    dataSize: number;
    bssSize: number;
    globalAssembly: Assembly;
    assembly: Assembly;
    scopeMap: Map<string, Scope>;
    labels: Array<[number, string]>;
    sourceMap: SourceMapGenerator;
    source: string;
}

interface CompileOptions {
    debugMode?: boolean;
    experimentalCpp?: boolean;
    eliminateConstantVariable?: boolean;
    detectStackPollution?: boolean;
}

interface LoopContext {
    breakPos: number[];
    continuePos: number[];
}

export class CompileContext {

    public fileName: string;
    public options: CompileOptions;

    public scopeMap: Map<string, Scope>;
    public memory: MemoryLayout;

    public labelMap: Map<string, number>;
    public unresolveGotoMap: Map<string, number[]>;
    public functionMap: Map<string, FunctionEntity>;
    public currentFunction: FunctionEntity | null;
    public currentScope: Scope;
    public currentNode: Node | null;
    public globalBuilder: InstructionBuilder;
    public currentBuilder: InstructionBuilder;
    public loopContext: LoopContext | null;
    public sourceMap?: SourceMapGenerator;
    public source?: string;
    public switchBuffer: number[];

    constructor(fileName: string, compileOptions: CompileOptions = {},
                source?: string, sourceMap?: SourceMapGenerator) {
        this.scopeMap = new Map<string, Scope>();
        this.currentScope = new Scope("@root", null);
        this.scopeMap.set(this.currentScope.getScopeName(), this.currentScope);
        this.currentScope.isRoot = true;
        this.functionMap = new Map<string, FunctionEntity>();
        this.memory = new MemoryLayout(1000);
        this.currentFunction = null;
        this.globalBuilder = new InstructionBuilder(1024);
        this.currentBuilder = this.globalBuilder;
        this.options = compileOptions;
        this.fileName = fileName;
        this.currentNode = null;
        this.loopContext = null;
        this.sourceMap = sourceMap;
        this.source = source;
        this.labelMap = new Map<string, number>();
        this.unresolveGotoMap = new Map<string, number[]>();
        this.switchBuffer = [];
        this.options.detectStackPollution = true;
    }

    public isCpp(): boolean {
        return !!this.options.experimentalCpp;
    }

    public enterScope(name: string | null) {
        if (name === null) {
            name = this.currentScope.children.length.toString();
        }
        const scope = this.scopeMap.get(this.currentScope.getScopeName() + "@" + name);
        if (scope != null) {
            this.currentScope = scope;
        } else {
            this.currentScope = new Scope(name, this.currentScope);
            if (this.currentScope.parent != null) {
                this.currentScope.parent.children.push(this.currentScope);
            }
            this.scopeMap.set(this.currentScope.getScopeName(), this.currentScope);
        }
    }

    public exitScope() {
        if (this.currentScope.parent != null) {
            this.currentScope = this.currentScope.parent;
        }
    }

    public enterFunction(functionEntity: FunctionEntity) {
        if ( this.unresolveGotoMap.size !== 0) {
            throw new InternalError("unresolved goto " +
                this.unresolveGotoMap.keys().next().value[0]);
        }
        this.functionMap.set(functionEntity.fullName, functionEntity);
        this.enterScope(functionEntity.name);
        this.memory.enterFunction();
        this.currentBuilder = new InstructionBuilder(1024);
        this.currentFunction = functionEntity;
        this.labelMap = new Map<string, number>();
    }

    public exitFunction() {
        if (this.currentFunction == null) {
            throw new InternalError(`this.currentFunction==null`);
        }
        if (this.currentBuilder == null) {
            throw new InternalError(`this.currentBuilder==null`);
        }
        this.currentFunction.code = this.currentBuilder.toAssembly();
        // this.currentFunction = null;
        this.currentBuilder = this.globalBuilder;
        this.exitScope();
    }

    public unresolve(name: string) {
        this.currentBuilder.unresolve(name);
    }

    public build(op: OpCode, imm?: string | number) {
        if (this.currentNode == null) {
            throw new InternalError(`this.currentNode==null`);
        }
        this.currentBuilder.build(this.currentNode.location.start.line, op, imm);
    }

    public raiseWarning(content: string) {
        console.log("[Warning]: " + content);
    }

    // only call once
    public toCompiledObject(): CompiledObject {
        if ( this.unresolveGotoMap.size !== 0) {
            throw new InternalError("unresolved goto " +
                this.unresolveGotoMap.keys().next().value[0]);
        }
        const size = Array.from(this.functionMap.values())
            .filter((func) => func.code !== null)
            .map((func) => (func.code as Assembly).size)
            .reduce((x, y) => x + y, 0);
        const resultBuffer = new ArrayBuffer(size);
        const code = new DataView(resultBuffer);
        const resultArray = new Uint8Array(resultBuffer);
        const unresolvedSymbols = [] as Array<[number, string]>;
        const labels = [] as Array<[number, string]>;
        const sourceMap = [] as Array<[number, number]>;
        let curSize = 0;
        for (const func of this.functionMap.values()) {
            labels.push([curSize, func.name]);
            if (func.code === null) {
                continue;
            }
            resultArray.set(new Uint8Array(func.code.code.buffer.slice(0, func.code.size)), curSize);
            for (const item of func.code.unresolvedSymbols) {
                unresolvedSymbols.push([item[0] + curSize, item[1]]);
            }
            if (this.options.debugMode) {
                for (const item of func.code.sourceMap) {
                    sourceMap.push([item[0] + curSize, item[1]]);
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
                sourceMap,
            },
            globalAssembly: this.globalBuilder.toAssembly(),
            labels,
            scopeMap: this.scopeMap,
            dataSize: this.memory.dataPtr,
            bssSize: this.memory.bssPtr,
            data: this.memory.data,
            source: this.source!,
            sourceMap: this.sourceMap!,
        };
    }
}
