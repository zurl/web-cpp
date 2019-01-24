/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 19/07/2018
 */

import {InternalError, SyntaxError} from "../common/error";
import {Node} from "../common/node";
import {FunctionEntity, OverloadSymbol, Symbol, Variable} from "../common/symbol";
import {ClassTemplate, FunctionTemplate} from "../common/template";
import {AccessControl, Type} from "../type";
import {ClassType} from "../type/class_type";
import {WAddressHolder} from "./address";
import {EvaluatedTemplateArgument} from "./template/template_argument";

export class FunctionLookUpResult {
    public instance: WAddressHolder | null;
    public instanceType: ClassType | null;
    public isDynamicCall: boolean;
    public functions: Array<FunctionEntity | FunctionTemplate>;
    public templateArguments: EvaluatedTemplateArgument[];

    constructor(functions: Array<FunctionEntity | FunctionTemplate>) {
        this.functions = functions;
        this.instance = null;
        this.instanceType = null;
        this.isDynamicCall = false;
        this.templateArguments = [];
    }
}

export type LookUpResult = Variable | Type | FunctionLookUpResult | ClassTemplate | null;

export function getShortName(lookupName: string): string {
    const tokens = lookupName.split("::");
    return tokens[tokens.length - 1];
}

export class Scope {
    public shortName: string;
    public fullName: string;
    public parent: Scope;
    public children: Scope[];
    public map: Map<string, Symbol[]>;
    public isCpp: boolean;
    public isInnerScope: boolean;
    public classType: ClassType | null;

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
        this.classType = null;
    }

    public getScopeOfLookupName(lookupName: string): Scope | null {
        if (lookupName.slice(0, 2) === "::") {
            lookupName = lookupName.slice(2);
        }
        const tokens = lookupName.split("::");
        if (tokens.length === 1) {
            return this;
        } else {
            for (const scope of this.children) {
                if (scope.shortName === tokens[0]) {
                    return scope.getScopeOfLookupName(tokens.slice(1).join("::"));
                }
            }
            return null;
        }
    }

    public mergeSymbolInScope(shortName: string, newItem: Symbol, node: Node): void {
        const oldItems = this.map.get(shortName);
        if (!oldItems) {
            this.map.set(shortName, [newItem]);
            return;
        }
        const oldItem = oldItems[0];
        if (oldItem instanceof OverloadSymbol) {
            if (!(newItem instanceof OverloadSymbol)) {
                throw new SyntaxError(`${shortName} has been declared as function`
                    + `but a ${newItem.constructor.name} found`, node);
            }
            for (let i = 0; i < oldItems.length; i++) {
                const x = oldItems[i] as OverloadSymbol;
                if (x.getFullName() === newItem.getFullName()) {
                    // TODO:: full check compatible?
                    if (x.isDefine() && !newItem.isDefine()) {
                        return;
                    } else if (x.isDefine() && newItem.isDefine()) {
                        throw new SyntaxError(`redefine of ${shortName}`, node);
                    } else if (!x.isDefine() && newItem.isDefine()) {
                        // hack access control
                        if (newItem.accessControl === AccessControl.Unknown) {
                            newItem.accessControl = x.accessControl;
                        }
                        oldItems[i] = newItem;
                        return;
                    } else if (!x.isDefine() && !newItem.isDefine()) {
                        return;
                    }
                }
            }
            oldItems.push(newItem);
            return;
        } else {
            if (oldItem instanceof Variable) {
                if (newItem.isDefine() && oldItem.isDefine()) {
                    throw new SyntaxError(`redefine of ${shortName}`, node);
                }
                if (newItem instanceof Variable) {
                    if (oldItem.type.equals(newItem.type)
                        && oldItem.fullName === newItem.fullName) {
                        if (newItem.isDefine()) {
                            if (newItem.accessControl === AccessControl.Unknown) {
                                newItem.accessControl = oldItem.accessControl;
                            }
                            oldItems[0] = newItem;
                        }
                        return;
                    } else {
                        throw new SyntaxError(`conflict declaration of ${shortName}`, node);
                    }
                } else {
                    throw new SyntaxError(`${shortName} has been declared as variable`
                        + `but a ${newItem.constructor.name} found`, node);
                }
            } else if (oldItem instanceof Type) {
                if (newItem instanceof Type) {
                    if (oldItem.equals(newItem)) {
                        return;
                    } else {
                        throw new SyntaxError(`conflict declaration of ${shortName}`, node);
                    }
                } else {
                    throw new SyntaxError(`${shortName} has been declared as type`
                        + `but a ${newItem.constructor.name} found`, node);
                }
            } else if (oldItem instanceof ClassTemplate) {
                if (newItem.isDefine() && oldItem.isDefine()) {
                    throw new SyntaxError(`redefine of ${shortName}`, node);
                }
                if (newItem instanceof ClassTemplate) {
                    if (oldItem.templateParams.length !== newItem.templateParams.length) {
                        throw new SyntaxError(`conflict declaration of ${shortName}`, node);
                    }
                    for (let i = 0; i < oldItem.templateParams.length; i++) {
                        if (!oldItem.templateParams[i].type.equals(newItem.templateParams[i].type)) {
                            throw new SyntaxError(`conflict declaration of ${shortName}`, node);
                        }
                    }
                    if (newItem.isDefine()) {
                        oldItems[0] = newItem;
                    }
                    return;
                } else {
                    throw new SyntaxError(`${shortName} has been declared as class template`
                        + `but a ${newItem.constructor.name} found`, node);
                }
            }
        }
        throw new InternalError(`assertCompatible()`);
    }

    public lookupInScope(anyName: string): Symbol[] | null {
        if (anyName.slice(0, 2) === "::") {
            throw new InternalError(`public lookupInScope(anyName: string){`);
        }
        const itemScope = this.getScopeOfLookupName(anyName);
        const shortName = getShortName(anyName);
        if (itemScope) {
            return itemScope.map.get(shortName) || null;
        }
        return null;
    }
}

export interface ScopeContext {
    scope: Scope;
    activeScopes: Scope[];
}

export class ScopeManager {

    public isCpp: boolean;

    public root: Scope;
    public currentContext: ScopeContext;
    public contextStack: ScopeContext[];

    public scopeId: number;
    public tmpVarId: number;

    constructor(isCpp: boolean) {
        this.isCpp = isCpp;
        this.root = new Scope("", null, isCpp);
        this.scopeId = 0;
        this.tmpVarId = 0;
        this.contextStack = [];
        this.currentContext = {
            scope: this.root,
            activeScopes: [this.root],
        };
    }

    public allocTmpVarName() {
        return "$__" + this.tmpVarId++;
    }

    public getFullName(anyName: string): string {
        const isFullLookup = anyName.slice(0, 2) === "::";
        if (isFullLookup) {
            return anyName;
        }
        for (let i = this.currentContext.activeScopes.length - 1; i >= 0; i--) {
            const scope = this.currentContext.activeScopes[i];
            const itemScope = scope.getScopeOfLookupName(anyName);
            const shortName = getShortName(anyName);
            if (itemScope && itemScope.map.has(shortName)) {
                return itemScope.fullName + "::" + shortName;
            }
        }
        return this.currentContext.scope.fullName + "::" + anyName;
    }

    public lookupFunction(anyName: string): LookUpResult {
        const scopes = anyName.slice(0, 2) === "::" ? [this.root] : this.currentContext.activeScopes;
        const realName = anyName.slice(0, 2) === "::" ? anyName.slice(2) : anyName;
        const shortName = getShortName(realName).split("@")[0];
        const isWithSignature = getShortName(realName).includes("@");
        const nameMap = new Set<string>();
        const result = [] as Array<FunctionTemplate | FunctionEntity>;
        for (let i = scopes.length - 1; i >= 0; i--) {
            const scope = scopes[i];
            const subScope = scope.getScopeOfLookupName(realName);
            if (subScope) {
                const item = subScope.map.get(shortName);
                if (item) {
                    for (const subItem of item) {
                        if (subItem instanceof FunctionTemplate || subItem instanceof FunctionEntity) {
                            if (!nameMap.has(subItem.shortName) && !isWithSignature ||
                                subItem.getFullName() === subScope.fullName + "::" + getShortName(realName)) {
                                nameMap.add(subItem.shortName);
                                result.push(subItem);
                            }
                        }
                    }
                }
            }
        }
        return new FunctionLookUpResult(result);
    }

    public lookup(anyName: string): LookUpResult {
        const scopes = anyName.slice(0, 2) === "::" ? [this.root] : this.currentContext.activeScopes;
        const realName = anyName.slice(0, 2) === "::" ? anyName.slice(2) : anyName;
        for (let i = scopes.length - 1; i >= 0; i--) {
            const item = this.currentContext.activeScopes[i].lookupInScope(realName);
            if (item) {
                const item0 = item[0];
                if (item0 instanceof OverloadSymbol) {
                    return this.lookupFunction(anyName);
                } else {
                    return item0 as LookUpResult;
                }
            }
        }
        return null;
    }

    public declare(lookupName: string, symbol: Symbol, node: Node) {
        const isRestrictLookup = lookupName.includes("::");
        const isFullLookup = lookupName.slice(0, 2) === "::";
        if ( isFullLookup ) {
            const restrictLookupName = lookupName.slice(2);
            const scope = this.root.getScopeOfLookupName(restrictLookupName);
            if (!scope) {
                throw new SyntaxError(`unresolved name ${lookupName}`, node);
            }
            const itemScope = scope.getScopeOfLookupName(restrictLookupName);
            const shortName = getShortName(restrictLookupName);
            if (itemScope && itemScope.map.has(shortName)) {
                scope.mergeSymbolInScope(shortName, symbol, node);
                return;
            }
            throw new SyntaxError(`unresolved name ${lookupName}`, node);
        } else if (isRestrictLookup) {
            for (const scope of this.currentContext.activeScopes) {
                const itemScope = scope.getScopeOfLookupName(lookupName);
                const shortName = getShortName(lookupName);
                if (itemScope && itemScope.map.has(shortName)) {
                    scope.mergeSymbolInScope(shortName, symbol, node);
                    return;
                }
            }
            throw new SyntaxError(`unresolved name ${lookupName}`, node);
        } else {
            this.currentContext.scope.mergeSymbolInScope(lookupName, symbol, node);
        }
    }

    public define(lookupName: string, symbol: Symbol, node: Node) {
        const isRestrictLookup = lookupName.includes("::");
        const isFullLookup = lookupName.slice(0, 2) === "::";
        if ( isFullLookup ) {
            const restrictLookupName = lookupName.slice(2);
            const scope = this.root.getScopeOfLookupName(restrictLookupName);
            if (!scope) {
                throw new SyntaxError(`unresolved name ${lookupName}`, node);
            }
            const itemScope = scope.getScopeOfLookupName(restrictLookupName);
            const shortName = getShortName(restrictLookupName);
            if (itemScope && itemScope.map.has(shortName)) {
                scope.mergeSymbolInScope(shortName, symbol, node);
                return;
            }
            throw new SyntaxError(`unresolved name ${lookupName}`, node);
        } else if (isRestrictLookup) {
            for (const scope of this.currentContext.activeScopes) {
                const itemScope = scope.getScopeOfLookupName(lookupName);
                const shortName = getShortName(lookupName);
                if (itemScope && itemScope.map.has(shortName)) {
                    scope.mergeSymbolInScope(shortName, symbol, node);
                    return;
                }
            }
            throw new SyntaxError(`unresolved name ${lookupName}`, node);
        } else {
            this.currentContext.scope.mergeSymbolInScope(lookupName, symbol, node);
        }
    }

    public enterScope(anyName: string) {
        this.contextStack.push(this.currentContext);
        const fullName = this.getFullName(anyName);
        const scope = this.root.getScopeOfLookupName(fullName);
        if (!scope) {
            throw new InternalError(`the scope of ${fullName} is not exist`);
        }
        let activeScopes = [] as Scope[];
        for (let item = scope; item !== this.root; item = item.parent) {
            activeScopes.push(item);
        }
        activeScopes.push(this.root);
        activeScopes = activeScopes.reverse();
        const oldScope = scope.children.filter((x) => x.fullName === fullName);
        if (oldScope.length) {
            activeScopes.push(oldScope[0]);
            this.currentContext = {
                scope: oldScope[0],
                activeScopes,
            };
        } else {
            const newScope = new Scope(getShortName(fullName), scope, this.isCpp);
            scope.children.push(newScope);
            activeScopes.push(newScope);
            this.currentContext = {
                scope: newScope,
                activeScopes,
            };
        }
    }

    public enterSavedScope(scopeContext: ScopeContext) {
        this.contextStack.push(this.currentContext);
        this.currentContext = scopeContext;
    }

    public exitScope() {
        if (this.contextStack.length === 0) {
            throw new InternalError(`this.contextStack.length === 0`);
        }
        this.currentContext = this.contextStack.pop()!;
    }

    // 1. for inner scope of compound statement
    // 2. for define scope of template
    public enterUnnamedScope(anonymous: boolean) {
        const newScope = new Scope("$" + this.scopeId++ , this.currentContext.scope, this.isCpp);
        if (anonymous) {
            newScope.fullName = this.currentContext.scope.fullName;
        }
        newScope.isInnerScope = true;
        this.currentContext.scope.children.push(newScope);
        this.contextStack.push(this.currentContext);
        const activeScopes = this.currentContext.activeScopes.map((x) => x);
        activeScopes.push(newScope);
        this.currentContext = {
            scope: newScope,
            activeScopes,
        };
    }

    public detachCurrentScope() {
        // remove temp scope
        const parent = this.currentContext.scope.parent;
        for (let i = 0; i < parent.children.length; i++) {
            if (parent.children[i] === this.currentContext.scope) {
                for (let j = i; j < parent.children.length - 1; j++) {
                    parent.children[j] = parent.children[j + 1];
                }
                break;
            }
        }
        parent.children.pop();
    }

    public isRoot() {
        return this.currentContext.scope === this.root;
    }

    public activeScopes(scopes: Scope[]) {
        const nameSet = new Set<string>(this.currentContext.activeScopes.map((x) => x.fullName));
        const newScopes = scopes.filter((x) => x.isInnerScope || !nameSet.has(x.fullName));
        const oldScopes = this.currentContext.activeScopes
            .filter((x) => x.fullName !== this.currentContext.scope.fullName);
        this.currentContext.activeScopes = [
            ...oldScopes, ...newScopes, this.currentContext.scope,
        ];
    }

    public getOldOverloadSymbol(fullName: string): OverloadSymbol | null {
        const oldItem = this.lookup(fullName.split("@")[0]);
        if (oldItem && oldItem instanceof FunctionLookUpResult) {
            const items = oldItem.functions.filter((x) => x.fullName === fullName);
            if (items.length) { return items[0]; }
        }
        return null;
    }
}
