/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {AccessControl, Type} from "../type";
import {FunctionType} from "../type/function_type";

export abstract class Symbol {
    public abstract isDefine(): boolean;

    public abstract getType(): Type;
}

export enum AddressType {
    GLOBAL,
    LOCAL,
    LOCAL_REF,
    STACK,
    MEMORY_DATA,
    MEMORY_BSS,
    MEMORY_EXTERN,
    RVALUE,
    CONSTANT,
    GLOBAL_SP,
}

export class Variable extends Symbol {
    public shortName: string;
    public fullName: string;
    public fileName: string;
    public type: Type;
    public addressType: AddressType;
    public location: number | string;

    constructor(shortName: string, fullName: string, fileName: string, type: Type,
                storageType: AddressType, location: number | string) {
        super();
        this.shortName = shortName;
        this.fullName = fullName;
        this.fileName = fileName;
        this.type = type;
        this.addressType = storageType;
        this.location = location;
    }

    public toString() {
        return `${this.shortName}:${this.type.toString()}`;
    }

    public isDefine() {
        return this.addressType !== AddressType.MEMORY_EXTERN;
    }

    public getType() {
        return this.type;
    }
}

export class FunctionEntity extends Symbol {
    public shortName: string;
    public fullName: string;
    public fileName: string;
    public type: FunctionType;
    public accessControl: AccessControl;

    public isLibCall: boolean;
    public hasDefine: boolean;
    public parametersSize: number;
    public $sp: number; // the 'local $sp' number

    public parameterInits: Array<null | string>;

    constructor(shortName: string, fullName: string, fileName: string,
                type: FunctionType, parameterInits: Array<null | string>,
                isLibCall: boolean, isDefine: boolean, accessControl: AccessControl) {
        super();
        this.shortName = shortName;
        this.fullName = fullName;
        this.fileName = fileName;
        this.type = type;
        this.isLibCall = isLibCall;
        this.hasDefine = isDefine;
        this.parameterInits = parameterInits;
        this.$sp = 0;
        this.parametersSize = type.parameterTypes
            .map((x) => x.length)
            .reduce((x, y) => x + y, 0);
        this.accessControl = accessControl;
    }

    public isDefine(): boolean {
        return this.hasDefine;
    }

    public getType() {
        return this.type;
    }
}
