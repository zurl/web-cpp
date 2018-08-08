/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 19/07/2018
 */

import {Node} from "../common/ast";
import {LanguageError, SyntaxError} from "../common/error";
import {FunctionEntity, Symbol, Variable} from "../common/symbol";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {WAddressHolder} from "./address";

export class Scope {
    public shortName: string;
    public fullName: string;
    public parent: Scope;
    public children: Scope[];
    public map: Map<string, Symbol[]>;
    public isCpp: boolean;
    public isInnerScope: boolean;

    constructor(shortName: string, parent: Scope | null, isCpp: boolean) {
        this.shortName = shortName;
        if (parent === null) {
            this.parent = this;
            this.fullName = "";
        } else {
            this.parent = parent;
            this.fullName = this.parent.fullName + "::" + this.shortName;
        }
        this.children = [];
        this.map = new Map<string, Symbol[]>();
        this.isCpp = isCpp;
        this.isInnerScope = false;
    }

    public declare(shortName: string, symbol: Symbol, node?: Node) {
        const realName = shortName.split("@")[0];
        const item = this.map.get(realName);
        if (!item) {
            this.map.set(realName, [symbol]);
        } else {
            if (item[0] instanceof FunctionEntity) {
                if (!(symbol instanceof FunctionEntity)) {
                    throw new SyntaxError(`redefine of ${shortName}`, node!);
                }
                if (!this.isCpp) {
                    throw new LanguageError(`function overload is support only in C++`, node!);
                }
                for (let i = 0; i < item.length; i++) {
                    const x = item[i];
                    if (x instanceof FunctionEntity) {
                        if (x.fullName === symbol.fullName) {
                            if (x.isDefine() && !symbol.isDefine()) {
                                return;
                            } else if (x.isDefine() && symbol.isDefine()) {
                                throw new SyntaxError(`redefine of ${shortName}`, node!);
                            } else if (!x.isDefine() && symbol.isDefine()) {
                                item[i] = symbol;
                                return;
                            } else if (!x.isDefine() && !symbol.isDefine()) {
                                return;
                            }
                        }
                    } else {
                        throw new SyntaxError(`redefine of ${shortName}`, node!);
                    }
                }
                item.push(symbol);
            } else {
                if (item.length !== 1) {
                    throw new SyntaxError(`redefine of ${shortName}`, node!);
                } else {
                    const x = item[0];
                    if (x.isDefine() && !symbol.isDefine()) {
                        return;
                    } else if (x.isDefine() && symbol.isDefine()) {
                        throw new SyntaxError(`redefine of ${shortName}`, node!);
                    } else if (!x.isDefine() && symbol.isDefine()) {
                        item[0] = symbol;
                        return;
                    } else if (!x.isDefine() && !symbol.isDefine()) {
                        return;
                    }
                }
            }
        }
    }

    public getScope(tokens: string[]): Scope | null {
        if (tokens.length === 0) {
            return this;
        }
        for (const scope of this.children) {
            if (scope.shortName === tokens[0]) {
                return scope.getScope(tokens.slice(1));
            }
        }
        return null;
    }

    public lookup(name: string): LookUpResult {
        const token = name.split("::").filter((x) => x);
        if (token.length > 1) {
            const realScope = this.getScope(token.slice(0, token.length - 1));
            if (realScope === null) {
                return null;
            }
            return realScope.lookup(token[token.length - 1]);
        }
        const array = this.map.get(token[0]);
        if (!array) {
            return null;
        }
        if (array[0] instanceof FunctionEntity) {
            return new FunctionLookUpResult(array as FunctionEntity[]);
        } else {
            return array[0] as Type | Variable;
        }

    }
}

export class FunctionLookUpResult {
    public instance: WAddressHolder | null;
    public instanceType: ClassType | null;
    public functions: FunctionEntity[];

    constructor(functions: FunctionEntity[]) {
        this.functions = functions;
        this.instance = null;
        this.instanceType = null;
    }
}

type LookUpResult = Variable | Type | FunctionLookUpResult | null;

export class ScopeManager {

    public root: Scope;
    public currentScope: Scope;
    public activeScopes: Set<Scope>;
    public scopeId: number;
    public isCpp: boolean;
    public tmpVarId: number;
    public tmpActiveScopes: Scope[];

    constructor(isCpp: boolean) {
        this.isCpp = isCpp;
        this.root = new Scope("", null, isCpp);
        this.currentScope = this.root;
        this.activeScopes = new Set<Scope>([this.root]);
        this.scopeId = 0;
        this.tmpVarId = 0;
        this.tmpActiveScopes = [];
    }

    public enterUnnamedScope() {
        const newScope = new Scope("$" + this.scopeId++, this.currentScope, this.isCpp);
        newScope.isInnerScope = true;
        this.currentScope.children.push(newScope);
        this.activeScopes.add(newScope);
        this.currentScope = newScope;
    }

    public enterScope(shortName: string) {
        const newScope = new Scope(shortName, this.currentScope, this.isCpp);
        this.currentScope.children.push(newScope);
        this.activeScopes.add(newScope);
        this.currentScope = newScope;
    }

    public exitScope() {
        this.activeScopes.delete(this.currentScope);
        this.currentScope = this.currentScope.parent;
        this.tmpActiveScopes.map((x) => this.activeScopes.delete(x));
        this.tmpActiveScopes = [];
    }

    public lookupAnyName(anyName: string): LookUpResult {
        if (anyName.slice(0, 2) === "::") {
            return this.lookupFullName(anyName);
        } else {
            return this.lookupShortName(anyName);
        }
    }

    public lookupFullName(fullName: string): LookUpResult {
        if (fullName.slice(0, 2) !== "::") {
            return null;
        }
        const token = fullName.split("::");
        const shortName = token[token.length - 1];
        const scope = this.root.getScope(token.slice(1, token.length - 1));
        if (scope === null) {
            return null;
        } else {
            return scope.lookup(shortName);
        }
    }

    public lookupShortName(shortName: string): LookUpResult {
        const array = Array.from(this.activeScopes.keys()).map(
            (x) => x.lookup(shortName))
            .filter((x) => x !== null).reverse();
        let result: FunctionLookUpResult | null = null;
        const funcNameSet = new Set<string>();
        for (const x of array) {
            if (x instanceof FunctionLookUpResult) {
                if (result === null) {
                    result = new FunctionLookUpResult([...x.functions]);
                    x.functions.map((y) => funcNameSet.add(y.fullName));
                } else {
                    for (const y of x.functions) {
                        if (!funcNameSet.has(y.fullName)) {
                            funcNameSet.add(y.fullName);
                            result.functions.push(y);
                        }
                    }
                }
            } else {
                if (result === null) {
                    return x;
                }
            }
        }
        return result;
    }

    public declareInScope(shortName: string, symbol: Symbol, scope: Scope, node?: Node): string {
        const item = this.innerLookUp(shortName);
        if (item !== null) {
            if (!item.getType().equals(symbol.getType())) {
                throw new SyntaxError(`conflict declaration of ${shortName}`, node!);
            }
        } else {
            scope.declare(shortName, symbol, node);
        }
        return scope.fullName + "::" + shortName;
    }

    public defineInScope(shortName: string, symbol: Symbol, scope: Scope, node?: Node): string {
        const item = this.innerLookUp(shortName);
        if (item !== null) {
            if (item.isDefine()) {
                throw new SyntaxError(`redefine of ${shortName}`, node!);
            }
            if (!item.getType().equals(symbol.getType())) {
                throw new SyntaxError(`conflict declaration of ${shortName}`, node!);
            }
        }
        scope.declare(shortName, symbol, node);
        return scope.fullName + "::" + shortName;
    }

    public declare(shortName: string, symbol: Symbol, node?: Node): string {
        return this.declareInScope(shortName, symbol, this.currentScope, node);
    }

    public define(shortName: string, symbol: Symbol, node?: Node): string {
        return this.defineInScope(shortName, symbol, this.currentScope, node);
    }

    public getFullName(shortName: string) {
        if (shortName.slice(0, 2) === "::") {
            return shortName;
        }
        return this.currentScope.fullName + "::" + shortName;
    }

    public isRoot() {
        return this.currentScope === this.root;
    }

    public allocTmpVarName() {
        return "$__" + this.tmpVarId++;
    }

    public lookupScope(scopeName: string): Scope | null {
        let curScope = this.root;
        const tokens = scopeName.split("::");
        if (scopeName.substr(0, 2) === "::") {
            for (let i = 1; i < tokens.length; i++) {
                const item = curScope.children.filter(((x) => x.shortName === tokens[i]));
                if (item.length !== 1) {
                    return null;
                }
                curScope = item[0];
            }
            return curScope;
        } else {
            for (const as of this.activeScopes) {
                const item = this.lookupScope(as.fullName + "::" + scopeName);
                if (item) {
                    return item;
                }
            }
            return null;
        }
    }

    public activeScope(scopeName: string): boolean {
        const scope = this.lookupScope(scopeName);
        if ( !scope ) { return false; }
        this.tmpActiveScopes.push(scope);
        this.activeScopes.add(scope);
        return true;
    }
    private innerLookUp(shortName: string): Symbol | null {
        const realName = shortName.split("@")[0];
        const result = this.lookupFullName(this.currentScope.fullName
            + "::" + realName);
        let item: Symbol | null = null;
        if (result instanceof FunctionLookUpResult) {
            const t = result.functions.filter((x) => x.fullName
                === this.currentScope.fullName + "::" + shortName);
            if (t.length > 0) {
                item = t[0];
            }
        } else {
            item = result;
        }
        return item;
    }

    // // Member Lookuppppp
    // public isScopeActive(scopeName: string) {
    //
    // }
    //

    //
    // public deactiveScope(scopeName: string) {
    //
    // }

}
