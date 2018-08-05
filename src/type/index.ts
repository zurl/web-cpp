import {InternalError} from "../common/error";
import {Symbol} from "../common/symbol";
import {WType} from "../wasm";

export abstract class Type extends Symbol {

    public isExtern: boolean;
    public isStatic: boolean;
    public isConst: boolean;
    public isVirtual: boolean;

    constructor() {
        super();
        this.isExtern = false;
        this.isStatic = false;
        this.isConst = false;
        this.isVirtual = false;
    }

    public equals(type: Type) {
        return this.constructor === type.constructor;
    }

    public compatWith(type: Type) {
        return this.constructor === type.constructor;
    }

    public abstract toWType(): WType;

    public abstract toString(): string;

    public abstract get length(): number;

    public abstract toMangledName(): string;

    public isDefine() {
        return false;
    }

    public getType(): Type {
        return this;
    }
}

export enum AccessControl {
    Public,
    Private,
    Protected,
}

export function getAccessControlFromString(str: string){
    if ( str === "public" ) {
        return AccessControl.Public;
    } else if ( str === "protected") {
        return AccessControl.Protected;
    } else {
        return AccessControl.Private;
    }
}
