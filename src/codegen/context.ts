/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {SourceMapGenerator} from "source-map";
import {InternalError} from "../common/error";
import {CompiledObject, ImportSymbol} from "../common/object";
import {FunctionEntity} from "../common/type";
import {WFunction, WImportFunction} from "../wasm";
import {WExpression, WStatement} from "../wasm/node";
import {MemoryLayout} from "./memory";
import {ScopeManager} from "./scope";

export interface CompileOptions {
    debugMode?: boolean;
    experimentalCpp?: boolean;
    eliminateConstantVariable?: boolean;
    detectStackPollution?: boolean;
}

export interface CaseContext {
    statements: WStatement[];
    value: WExpression | null;
}

export interface SwitchContext {
    cases: CaseContext[];
}

export class CompileContext {

    public fileName: string;
    public options: CompileOptions;
    public memory: MemoryLayout;
    public functionMap: Map<string, FunctionEntity>;
    public currentFunction: FunctionEntity | null;
    public statementContainer: WStatement[];
    public blockLevel: number;
    public scopeManager: ScopeManager;
    public switchContext: SwitchContext | null;
    public breakStack: number[];
    public continueStack: number[];

    // result
    public functions: WFunction[];
    public imports: ImportSymbol[];

    // debug
    public source?: string;
    public sourceMap?: SourceMapGenerator;

    constructor(fileName: string, compileOptions: CompileOptions = {},
                source?: string, sourceMap?: SourceMapGenerator) {
        this.scopeManager = new ScopeManager();
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
        this.switchContext = null;
        this.breakStack = [];
        this.continueStack = [];
        this.blockLevel = 0;
    }

    public isCpp(): boolean {
        return !!this.options.experimentalCpp;
    }

    public enterFunction(functionEntity: FunctionEntity) {
        this.functionMap.set(functionEntity.name, functionEntity);
        this.scopeManager.enterScope(functionEntity.name);
        this.memory.enterFunction();
        this.currentFunction = functionEntity;
    }

    public exitFunction() {
        if (this.currentFunction == null) {
            throw new InternalError(`this.currentFunction==null`);
        }
        this.scopeManager.exitScope();
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
