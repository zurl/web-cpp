/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 18/06/2018
 */

import {FunctionDefinition} from "../common/ast";
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

    constructor(name: string, fileName: string, fullName: string, type: FunctionType) {
        this.name = name;
        this.fileName = fileName;
        this.code = null;
        this.type = type;
        this.location = 0;
        this.fullName = fullName;
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

/**
 * ScopeMapMerge Rules
 * 1.Root could not be conflict?
 *
 * @param {Map<string, Scope>[][]} scopeMap
 * @returns {Map<string, Scope>[]}
 */
// export function mergeScopeMap(scopeMap: Map<string, Scope>[][]): Map<string, Scope>[]{

// }

// export class Function {
//     codes: Instruction[];
//     returnType: Type;
//     parameterTypes: Type[];
//     parameterNames: string[];
//     name: string;
// }
