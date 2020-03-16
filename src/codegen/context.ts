/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {SourceMapGenerator} from "source-map";
import {InternalError} from "../common/error";
import {Node} from "../common/node";
import {CompiledObject, ImportSymbol} from "../common/object";
import {FunctionEntity} from "../common/symbol";
import {WExpression, WFunction, WStatement} from "../wasm";
import {triggerAllDestructor} from "./class/destructor";
import {MemoryLayout} from "./memory";
import {ScopeManager} from "./scope";

export interface CompileOptions {
    debug?: boolean;
    isCpp?: boolean;
}

export interface CaseContext {
    statements: WStatement[];
    value: WExpression | null;
}

export interface SwitchContext {
    cases: CaseContext[];
}
export interface FuncContext {
    statementContainer: WStatement[];
    blockLevel: number;
    switchContext: SwitchContext | null;
    breakStack: number[];
    continueStack: number[];
    currentFunction: FunctionEntity | null;
}

export class CompileContext {

    // meta data
    public fileName: string;
    public options: CompileOptions;

    // global shared
    public memory: MemoryLayout;
    public functionMap: Map<string, FunctionEntity>;
    public scopeManager: ScopeManager;
    public requiredWASMFuncTypes: Set<string>;
    public functions: WFunction[];
    public imports: ImportSymbol[];

    // function internal
    public funcContexts: FuncContext[];
    public currentFuncContext: FuncContext;

    // debug
    public source?: string;
    public sourceMap?: SourceMapGenerator;

    constructor(fileName: string, compileOptions: CompileOptions = {},
                source?: string, sourceMap?: SourceMapGenerator) {
        this.scopeManager = new ScopeManager(!!compileOptions.isCpp);
        this.functionMap = new Map<string, FunctionEntity>();
        this.memory = new MemoryLayout(1000);
        this.options = compileOptions;
        this.fileName = fileName;
        this.sourceMap = sourceMap;
        this.source = source;
        this.functions = [];
        this.imports = [];
        this.currentFuncContext = {
            statementContainer: [],
            switchContext: null,
            breakStack: [],
            continueStack: [],
            blockLevel: 0,
            currentFunction: null,
        };
        this.funcContexts = [];
        this.requiredWASMFuncTypes = new Set<string>();
    }

    public isCpp(): boolean {
        return !!this.options.isCpp;
    }

    public enterFunction(functionEntity: FunctionEntity) {
        this.functionMap.set(functionEntity.shortName, functionEntity);
        this.scopeManager.enterScope(functionEntity.fullName);
        this.memory.enterFunction();
        this.funcContexts.push(this.currentFuncContext);
        this.currentFuncContext = {
            statementContainer: [],
            switchContext: null,
            breakStack: [],
            continueStack: [],
            blockLevel: 0,
            currentFunction: functionEntity,
        };
    }

    public exitFunction() {
        if (this.funcContexts.length <= 0) {
            throw new InternalError(`this.currentFunction==null`);
        }
        this.memory.exitFunction();
        this.scopeManager.exitScope();
        this.currentFuncContext = this.funcContexts.pop()!;
    }

    public enterScope() {
        this.scopeManager.enterUnnamedScope(false);
    }

    public exitScope(node: Node) {
        triggerAllDestructor(this, node);
        this.scopeManager.exitScope();
    }

    public setStatementContainer(constainer: WStatement[]) {
        this.currentFuncContext.statementContainer = constainer;
    }

    public getStatementContainer(): WStatement[] {
        return this.currentFuncContext.statementContainer;
    }

    public submitStatement(statement: WStatement) {
        this.currentFuncContext.statementContainer.push(statement);
    }

    public submitFunction(func: WFunction) {
        this.functions.push(func);
    }

    public raiseWarning(content: string, node: Node) {
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
            globalStatements: this.currentFuncContext.statementContainer,
            source: this.source,
            sourceMap: this.sourceMap,
            requiredWASMFuncTypes: this.requiredWASMFuncTypes,
            scope: this.scopeManager.root,
        };
    }
}
