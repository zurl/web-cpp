/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {SourceMapGenerator} from "source-map";
import {Node} from "../common/ast";
import {InternalError} from "../common/error";
import {CompiledObject, ImportSymbol} from "../common/object";
import {AddressType, FunctionEntity, Variable} from "../common/symbol";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {FunctionType} from "../type/function_type";
import {EvaluatedTemplateArgument, FunctionTemplate} from "../type/template_type";
import {WFunction} from "../wasm";
import {WExpression, WStatement} from "../wasm/node";
import {triggerDestructor} from "./cpp/lifecycle";
import {MemoryLayout} from "./memory";
import {Scope, ScopeManager} from "./scope";

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

export interface DeferInstantiationTask {
    funcTemplate: FunctionTemplate;
    type: FunctionType;
    args: EvaluatedTemplateArgument[];
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
        this.functionMap.set(functionEntity.name, functionEntity);
        this.scopeManager.enterScope(functionEntity.name);
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

    public triggerDtors(node: Node, scope: Scope) {
        for (const item of scope.map.values()) {
            const x = item[0];
            if (x instanceof Variable && x.type instanceof ClassType) {
                triggerDestructor(this, x, node);
            }
        }
    }

    public triggerDtorsInner(node: Node) {
        let scope = this.scopeManager.currentScope;
        while (scope.isInnerScope) {
            this.triggerDtors(node, scope);
            scope = scope.parent;
        }
        this.triggerDtors(node, scope);
    }

    public enterScope() {
        this.scopeManager.enterUnnamedScope(false);
    }

    public exitScope(node: Node) {
        this.triggerDtors(node, this.scopeManager.currentScope);
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

    public allocTmpVar(type: Type, node: Node): [string, Variable] {
        const varName = this.scopeManager.allocTmpVarName();
        const varEntity = new Variable(varName, varName, node.location.fileName, type,
            AddressType.STACK, this.memory.allocStack(type.length));
        this.scopeManager.define(varName, varEntity, node);
        return [varName, varEntity];
    }
}
