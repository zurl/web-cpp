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
import {PrimitiveTypes} from "../type/primitive_type";
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
    public requiredWASMFuncTypes: Set<string>;

    // result
    public functions: WFunction[];
    public imports: ImportSymbol[];

    // debug
    public source?: string;
    public sourceMap?: SourceMapGenerator;

    constructor(fileName: string, compileOptions: CompileOptions = {},
                source?: string, sourceMap?: SourceMapGenerator) {
        this.scopeManager = new ScopeManager(!!compileOptions.isCpp);
        this.functionMap = new Map<string, FunctionEntity>();
        this.memory = new MemoryLayout(1000);
        this.currentFunction = null;
        this.options = compileOptions;
        this.fileName = fileName;
        this.sourceMap = sourceMap;
        this.source = source;
        this.statementContainer = [];
        this.functions = [];
        this.imports = [];
        this.switchContext = null;
        this.breakStack = [];
        this.continueStack = [];
        this.blockLevel = 0;
        this.requiredWASMFuncTypes = new Set<string>();
    }

    public isCpp(): boolean {
        return !!this.options.isCpp;
    }

    public enterFunction(functionEntity: FunctionEntity) {
        this.functionMap.set(functionEntity.name, functionEntity);
        this.scopeManager.enterScope(functionEntity.name);
        this.memory.enterFunction();
        this.currentFunction = functionEntity;
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

    public exitFunction() {
        if (this.currentFunction == null) {
            throw new InternalError(`this.currentFunction==null`);
        }
        this.memory.exitFunction();
        this.scopeManager.exitScope();
    }

    public enterScope() {
        this.scopeManager.enterUnnamedScope();
    }

    public exitScope(node: Node) {
        this.triggerDtors(node, this.scopeManager.currentScope);
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
            requiredWASMFuncTypes: this.requiredWASMFuncTypes,
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
