/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 18/06/2018
 */

import {FunctionDefinition} from "../common/ast";
import {LinkerError} from "../common/error";
import {Assembly} from "../common/instruction";
import {FunctionType, Type} from "../common/type";

export enum VariableStorageType {
    STACK,
    MEMORY_DATA,
    MEMORY_BSS,
    MEMORY_EXTERN,
}

export class Variable {
    public name: string;
    public fileName: string;
    public type: Type;
    public storageType: VariableStorageType;
    public location: number | string;

    constructor(name: string, fileName: string, type: Type,
                storageType: VariableStorageType, location: number | string) {
        this.name = name;
        this.fileName = fileName;
        this.type = type;
        this.storageType = storageType;
        this.location = location;
    }

    public toString() {
        return `${this.name}:${this.type.toString()}`;
    }
}

export class FunctionEntity {
    public name: string;
    public fileName: string;
    public code: Assembly | null;
    public location: string | number;
    public type: FunctionType;
    public fullName: string;
    public isLibCall: boolean;

    constructor(name: string, fileName: string, fullName: string, type: FunctionType) {
        this.name = name;
        this.fileName = fileName;
        this.code = null;
        this.type = type;
        this.location = 0;
        this.fullName = fullName;
        this.isLibCall = false;
    }
}

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
        this.map.set(key, value);
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
                if (srcval.code === null && dstval.code === null) { continue; }
                if (srcval.code !== null && dstval.code === null) {
                    dst.map.set(tuple[0], tuple[1]);
                }
                if (srcval.code === null && dstval.code !== null) { continue; }
                if (srcval.code !== null && dstval.code !== null) {
                    throw new LinkerError(`Duplicated Definition of ${srcval.name}`);
                }
            }
            if (srcval instanceof Variable
                && dstval instanceof Variable
                && srcval.type.equals(dstval.type)) {
                if (srcval.storageType === VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType === VariableStorageType.MEMORY_EXTERN) { continue; }
                if (srcval.storageType !== VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType === VariableStorageType.MEMORY_EXTERN) {
                    dst.map.set(tuple[0], tuple[1]);
                }
                if (srcval.storageType === VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType !== VariableStorageType.MEMORY_EXTERN) { continue; }
                if (srcval.storageType !== VariableStorageType.MEMORY_EXTERN
                    && dstval.storageType !== VariableStorageType.MEMORY_EXTERN) {
                    throw new LinkerError(`Duplicated Definition of ${srcval.name}`);
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
