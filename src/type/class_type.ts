/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {AccessControl, Type} from ".";
import {WAddressHolder} from "../codegen/address";
import {CompileContext} from "../codegen/context";
import {FunctionLookUpResult} from "../codegen/scope";
import {Expression, ObjectInitializer} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {Variable} from "../common/symbol";
import {WType} from "../wasm";
import {PrimitiveTypes} from "./primitive_type";

export interface ClassField {
    name: string;
    type: Type;
    startOffset: number;
    initializer: Expression | ObjectInitializer | null;
    accessControl: AccessControl;
}

export interface Inheritance {
    classType: ClassType;
    accessControl: AccessControl;
}

export class ClassType extends Type {

    public isUnion: boolean;
    public isComplete: boolean;
    public name: string;
    public fullName: string;
    public fileName: string;
    public fields: ClassField[];
    public fieldMap: Map<string, ClassField>;
    public inheritance: Inheritance[];
    public selfSize: number;
    public objectSize: number;

    // vptr settings
    public requireVPtr: boolean;
    public VPtrOffset: number;

    constructor(name: string, fullName: string, fileName: string,
                fields: ClassField[], isUnion: boolean, inheritance: Inheritance[]) {
        super();
        this.name = name;
        this.fileName = fileName;
        this.fullName = fullName;
        this.fields = fields;
        this.isComplete = true;
        this.fieldMap = new Map<string, ClassField>();
        this.isUnion = isUnion;
        this.inheritance = inheritance;
        this.requireVPtr = false;
        this.VPtrOffset = 0;
        this.selfSize = 0;
        this.objectSize = this.inheritance.map(
            (x) => x.classType.length).reduce((x, y) => x + y, 0);
    }

    public initialize() {
        this.fieldMap = new Map<string, ClassField>(
            this.fields.map((x) => [x.name, x] as [string, ClassField]));
        if (this.isUnion) {
            this.selfSize = Math.max(...this.fields
                .map((field) => field.type.length));
        } else {
            this.selfSize = this.fields
                .map((field) => field.type.length)
                .reduce((x, y) => x + y, 0);
        }
        this.objectSize = this.selfSize + this.inheritance.map(
            (x) => x.classType.length).reduce((x, y) => x + y, 0);
    }

    get length(): number {
        if (!this.isComplete) {
            throw new InternalError(`class ${this.name} is incomplete`);
        }
        return this.objectSize;
    }

    public toWType(): WType {
        throw new InternalError(`could not to Wtype of func`);
    }

    public toString() {
        return `[Class ${this.name}]`;
    }

    public toMangledName() {
        return "$" + this.fullName;
    }

    public isDefine(): boolean {
        return this.isComplete;
    }

    public equals(type: Type): boolean {
        return type === this;
    }

    public isSubClassOf(type: ClassType): boolean {
        for (const item of this.inheritance) {
            if (item.classType.isSubClassOf(type)) {
                return true;
            }
        }
        return type === this;
    }

    public compatWith(type: Type): boolean {
        return type === this || (
            type instanceof ClassType && (
                type.isSubClassOf(this) || this.isSubClassOf(type)
            ));
    }

    public getField(name: string): ClassField | null {
        if (!this.isComplete) {
            throw new InternalError(`class ${this.name} is incomplete`);
        }
        const item = this.fieldMap.get(name);
        if (item) {
            return item;
        }
        for (const obj of this.inheritance) {
            const subItem = obj.classType.getField(name);
            if (subItem) {
                return subItem;
            }
        }
        return null;
    }

    public getMember(ctx: CompileContext, name: string): ClassField | Variable | FunctionLookUpResult | null {
        const item = ctx.scopeManager.lookupFullName(this.fullName + "::" + name);
        if (item !== null) {
            if (item instanceof Type) {
                return null;
            } else {
                return item;
            }
        }
        const field = this.fieldMap.get(name);
        if ( field ) {
            return field;
        }
        for (const obj of this.inheritance) {
            const subItem = obj.classType.getMember(ctx, name);
            if (subItem) {
                return subItem;
            }
        }
        return null;
    }
}
