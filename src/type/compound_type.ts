/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {InternalError} from "../common/error";
import {WType} from "../wasm";
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

    public compatWith(type: Type): boolean {
        return super.compatWith(type) &&
            type instanceof CompoundType &&
            this.elementType.compatWith(type.elementType);
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

    public compatWith(type: Type): boolean {
        return this.elementType.equals(PrimitiveTypes.void)
            || (type instanceof PointerType && type.elementType.equals(PrimitiveTypes.void))
            || super.compatWith(type) ||
            (type instanceof ArrayType && this.elementType.compatWith(type.elementType));
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

    public compatWith(type: Type): boolean {
        return type.equals(this)
            || (type instanceof ArrayType && this.elementType.compatWith(type.elementType)
                || (
                    type instanceof PointerType && type.elementType.equals(this.elementType)));
    }
}
