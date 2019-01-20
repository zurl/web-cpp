import {InternalError} from "../common/error";
import {Symbol} from "../common/symbol";
import {WType} from "../wasm";

export abstract class Type extends Symbol {
    public isConst: boolean;

    constructor() {
        super();
        this.isConst = false;
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
    Unknown,
}

export function getAccessControlFromString(str: string) {
    if ( str === "public" ) {
        return AccessControl.Public;
    } else if ( str === "protected") {
        return AccessControl.Protected;
    } else {
        return AccessControl.Private;
    }
}
