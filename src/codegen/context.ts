/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {SourceMapGenerator} from "source-map";
import {InternalError} from "../common/error";
import {CompiledObject, ImportSymbol} from "../common/object";
import {FunctionEntity} from "../common/type";
import {ImportObject} from "../runtime/runtime";
import {WFunction, WImportFunction} from "../wasm";
import {WStatement} from "../wasm/node";
import {MemoryLayout} from "./memory";
import {Scope} from "./scope";

export interface CompileOptions {
    debugMode?: boolean;
    experimentalCpp?: boolean;
    eliminateConstantVariable?: boolean;
    detectStackPollution?: boolean;
}

export class CompileContext {

    public fileName: string;
    public options: CompileOptions;
    public scopeMap: Map<string, Scope>;
    public memory: MemoryLayout;
    public functionMap: Map<string, FunctionEntity>;
    public currentFunction: FunctionEntity | null;
    public currentScope: Scope;
    public statementContainer: WStatement[];
    public loopStack: [number, number][];
    public blockLevel: number;

    // result
    public functions: WFunction[];
    public imports: ImportSymbol[];

    // debug
    public source?: string;
    public sourceMap?: SourceMapGenerator;

    constructor(fileName: string, compileOptions: CompileOptions = {},
                source?: string, sourceMap?: SourceMapGenerator) {
        this.scopeMap = new Map<string, Scope>();
        this.currentScope = new Scope("", null);
        this.scopeMap.set(this.currentScope.getScopeName(), this.currentScope);
        this.currentScope.isRoot = true;
        this.functionMap = new Map<string, FunctionEntity>();
        this.memory = new MemoryLayout(1000);
        this.currentFunction = null;
        this.options = compileOptions;
        this.fileName = fileName;
        this.sourceMap = sourceMap;
        this.source = source;
        this.options.detectStackPollution = true;
        this.statementContainer = [];
        this.functions = [];
        this.imports = [];
        this.loopStack = [];
        this.blockLevel = 0;
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
        this.functionMap.set(functionEntity.fullName, functionEntity);
        this.enterScope(functionEntity.name);
        this.memory.enterFunction();
        this.currentFunction = functionEntity;
    }

    public exitFunction() {
        if (this.currentFunction == null) {
            throw new InternalError(`this.currentFunction==null`);
        }
        this.exitScope();
    }

    public setStatementContainer(constainer: WStatement[]) {
        this.statementContainer = constainer;
    }

    public getStatementContainer(): WStatement[] {
        return this.statementContainer;
    }

    public submitStatement(statement: WStatement) {
        this.statementContainer.push(statement);
    }

    public submitFunction(func: WFunction) {
        this.functions.push(func);
    }

    public raiseWarning(content: string) {
        console.log("[Warning]: " + content);
    }

    public toCompiledObject(): CompiledObject {
        return {
            fileName: this.fileName,
            dataSize: this.memory.dataPtr,
            functions: this.functions,
            imports: this.imports,
            exports: [], // TODO:: exports
            data: this.memory.dataBuffer,
            globalStatements: this.statementContainer,
            source: this.source,
            sourceMap: this.sourceMap,
        };
    }
}
