/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 18/06/2018
 */


import {FunctionType, Type} from "../common/type";
import {Assembly} from "../common/instruction";
import {FunctionDefinition} from "../common/ast";

export enum VariableStorageType {
    STACK,
    MEMORY_DATA,
    MEMORY_BSS,
    MEMORY_EXTERN
}

export class Variable {
    name: string;
    fileName: string;
    type: Type;
    storageType: VariableStorageType;
    location: number | string;

    constructor(name: string, fileName: string, type: Type, storageType: VariableStorageType, location: number | string) {
        this.name = name;
        this.fileName = fileName;
        this.type = type;
        this.storageType = storageType;
        this.location = location;
    }

    toString(){
        return `${this.name}:${this.type.toString()}`;
    }
}

export class FunctionEntity{
    name: string;
    fileName: string;
    code: Assembly | null;
    location: string | number;
    type: FunctionType;
    fullName: string;

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
    name: string;
    map: Map<string, Variable | FunctionEntity | Type>;
    parent: Scope | null;
    isRoot: boolean;
    children: Scope[];

    constructor(name: string, parent: Scope | null) {
        this.name = name;
        this.map = new Map<string, Variable | FunctionEntity | Type>();
        this.parent = parent;
        this.isRoot = false;
        this.children = [];
    }

    get(key: string): Variable | FunctionEntity | Type | null {
        const value = this.map.get(key);
        if (value !== undefined) return value;
        if (this.parent != null) return this.parent.get(key);
        return null;
    }

    getInCurrentScope(key: string): Variable | FunctionEntity | Type | null {
        const value = this.map.get(key);
        if (value !== undefined) return value;
        return null;
    }

    set(key: string, value: Variable | FunctionEntity | Type) {
        this.map.set(key, value);
    }

    getScopeName(): string {
        if (this.parent == null) return this.name;
        else return this.parent.getScopeName() + "@" + this.name;
    }
}

/**
 * ScopeMapMerge Rules
 * 1.Root could not be conflict?
 *
 * @param {Map<string, Scope>[][]} scopeMap
 * @returns {Map<string, Scope>[]}
 */
//export function mergeScopeMap(scopeMap: Map<string, Scope>[][]): Map<string, Scope>[]{

//}

// export class Function {
//     codes: Instruction[];
//     returnType: Type;
//     parameterTypes: Type[];
//     parameterNames: string[];
//     name: string;
// }