/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {InternalError} from "../common/error";
import {WType} from "../wasm";
import {ClassType} from "./class_type";
import {Type} from "./index";
import {PrimitiveTypes} from "./primitive_type";

const MACHINE_POINTER_LENGTH = 4;

export abstract class CompoundType extends Type {
    public elementType: Type;

    constructor(elementType: Type) {
        super();
        this.elementType = elementType;
    }

    get length() {
        return MACHINE_POINTER_LENGTH;
    }

    public equals(type: Type): boolean {
        return super.equals(type) &&
            type instanceof CompoundType &&
            this.elementType.equals(type.elementType);
    }
}

export class ConstType extends CompoundType {
    public toString() {
        return "const" + this.elementType.toString();
    }

    public toWType() {
        return this.elementType.toWType();
    }

    public toMangledName(): string {
        return "c" + this.elementType.toMangledName();
    }
}

export class PointerType extends CompoundType {
    public toString() {
        return this.elementType.toString() + "*";
    }

    public toWType() {
        return WType.u32;
    }

    public toMangledName(): string {
        return this.elementType.toMangledName() + "*";
    }
}

export abstract class ReferenceType extends CompoundType {

    constructor(elementType: Type) {
        super(elementType);
        if (elementType instanceof ReferenceType) {
            throw new InternalError(`ref to ref is illegal`);
        }
    }
}

export class LeftReferenceType extends ReferenceType {
    public toString() {
        return this.elementType.toString() + "&";
    }

    public toWType() {
        return WType.u32;
    }

    public toMangledName(): string {
        return this.elementType.toMangledName() + "&";
    }
}

export class RightReferenceType extends ReferenceType {
    public toString() {
        return this.elementType.toString() + "&&";
    }

    public toWType() {
        return WType.u32;
    }

    public toMangledName(): string {
        return this.elementType.toMangledName() + "&&";
    }
}

export class ArrayType extends Type {

    public elementType: Type;
    public size: number;

    constructor(elementType: Type, size: number) {
        super();
        this.elementType = elementType;
        this.size = size;
    }

    get length() {
        return this.elementType.length * this.size;
    }

    public equals(type: Type): boolean {
        return super.equals(type) &&
            type instanceof ArrayType &&
            this.elementType.equals(type.elementType) &&
            this.size === type.size;
    }

    public toString() {
        return this.elementType.toString() + `[${this.length}]`;
    }

    public toWType(): WType {
        throw new InternalError(`could not to Wtype of func`);
    }

    public toMangledName(): string {
        return this.elementType.toMangledName() + "[" + this.size + "]";
    }
}
