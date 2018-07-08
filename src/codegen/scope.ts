/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 18/06/2018
 */

import {InternalError, LinkerError} from "../common/error";
import {FunctionEntity, Type, Variable, VariableStorageType} from "../common/type";
import {getIndent} from "../common/utils";

export class Scope {
    public name: string;
    public map: Map<string, Variable | FunctionEntity | Type>;
    public parent: Scope | null;
    public isRoot: boolean;
    public children: Scope[];

    constructor(name: string, parent: Scope | null) {
        this.name = name;
        this.map = new Map<string, Variable | FunctionEntity | Type>();
        this.parent = parent;
        this.isRoot = false;
        this.children = [];
    }

    public get(key: string): Variable | FunctionEntity | Type | null {
        const value = this.map.get(key);
        if (value !== undefined) { return value; }
        if (this.parent != null) { return this.parent.get(key); }
        return null;
    }

    public getInCurrentScope(key: string): Variable | FunctionEntity | Type | null {
        const value = this.map.get(key);
        if (value !== undefined) { return value; }
        return null;
    }

    public set(key: string, value: Variable | FunctionEntity | Type) {
        if ( this.map.has(key) ) {
            throw new InternalError(`redefined key at set() ${key}`);
        }
        this.map.set(key, value);
    }

    public hasInCurrentScope(key: string): boolean {
        return this.map.has(key);
    }

    public getScopeName(): string {
        if (this.parent == null) { return this.name; } else { return this.parent.getScopeName() + "@" + this.name; }
    }
}

export function mergeScopeTo(dst: Scope, src: Scope) {
    for (const tuple of src.map.entries()) {
        const dstval = dst.map.get(tuple[0]);
        if (dstval === undefined) {
            dst.map.set(tuple[0], tuple[1]);
        } else {
            const srcval = tuple[1];
            if (srcval instanceof FunctionEntity
                && dstval instanceof FunctionEntity
                && srcval.type.equals(dstval.type)) {
                if (!srcval.isDefine() && !dstval.isDefine()) { continue; }
                if (srcval.isDefine() && !dstval.isDefine()) {
                    dst.map.set(tuple[0], tuple[1]);
                    continue;
                }
                if (!srcval.isDefine() && dstval.isDefine()) { continue; }
                if (srcval.isDefine() && dstval.isDefine()) {
                    throw new LinkerError(`Duplicated Definition of ${srcval.name}`);
                }
            } else if (srcval instanceof Variable
                && dstval instanceof Variable
                && srcval.type.equals(dstval.type)) {
                if (srcval.storageType === VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType === VariableStorageType.MEMORY_EXTERN) { continue; }
                if (srcval.storageType !== VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType === VariableStorageType.MEMORY_EXTERN) {
                    dst.map.set(tuple[0], tuple[1]);
                    continue;
                }
                if (srcval.storageType === VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType !== VariableStorageType.MEMORY_EXTERN) { continue; }
                if (srcval.storageType !== VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType !== VariableStorageType.MEMORY_EXTERN) {
                    throw new LinkerError(`Duplicated Definition of ${srcval.name}`);
                }
            } else if (srcval instanceof Type && dstval instanceof Type) {
                if (srcval.equals(dstval)) {
                    continue;
                }
            }
            throw new LinkerError(`Different definition of ${srcval.toString()} and  ${dstval.toString()}`);
        }
    }
}

export function mergeScopeMap(scopeMaps: Array<Map<string, Scope>>): Map<string, Scope> {
    const result = new Map<string, Scope>();
    for (const scopeMap of scopeMaps) {
        for (const tuple of scopeMap.entries()) {
            const item = result.get(tuple[0]);
            if (item === undefined) {
                result.set(tuple[0], tuple[1]);
            } else {
                mergeScopeTo(item, tuple[1]);
            }
        }
    }
    return result;
}

export function dumpScopeMap(scopeMap: Map<string, Scope>): string {
    let result = "";
    for (const scope of scopeMap.values()) {
        result += `[${scope.getScopeName()}]:\n`;
        for (const key of scope.map.keys()) {
            const item = scope.map.get(key);
            if ( item instanceof Type) {
                result += `\t(Type)${key}: ${item.toString()}\n`;
            } else if ( item instanceof FunctionEntity) {
                result += `\t(Func)${key}: ${item.type.toString()}\n`;
            } else if ( item instanceof Variable) {
                result += `\t(Var)${key}: ${item.type.toString()},` +
                    `${VariableStorageType[item.storageType]}, len=${item.type.length}`
                    + `, loc=${item.location}\n`;
            }
        }
    }
    return result;
}

export function cloneScopeMap(scopeMap: Map<string, Scope>): Map<string, Scope> {
    const result = new Map<string, Scope>();
    for (const entity of scopeMap.entries()) {
        const scope = new Scope(entity[1].name, entity[1].parent);
        result.set(entity[0], scope);
        for (const item of entity[1].map) {
            scope.set(item[0], item[1]);
        }
        if ( entity[1].isRoot ) { scope.isRoot = true; }
    }
    for (const entity of result.entries()) {
        if ( entity[1].parent !== null) {
            entity[1].parent = result.get(entity[1].parent!.getScopeName())!;
            if ( !entity[1].parent) {
                throw new InternalError(`unexpected error in cloneScopeMap`);
            }
        }
        for (const child of entity[1].children) {
            entity[1].children.push(result.get(child.getScopeName())!);
        }
    }
    return result;
}
