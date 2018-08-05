import {Type} from ".";
import {Expression, ObjectInitializer} from "../common/ast";
import {InternalError} from "../common/error";
import {WType} from "../wasm";

enum AccessControl {
    Public,
    Private,
    Protected,
}

export interface ClassField {
    name: string;
    type: Type;
    startOffset: number;
    initializer: Expression | ObjectInitializer | null;
}

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

export class ClassType extends Type {

    public isUnion: boolean;
    public isComplete: boolean;
    public name: string;
    public fullName: string;
    public fileName: string;
    public fields: ClassField[];
    public fieldMap: Map<string, ClassField>;

    constructor(name: string, fullName: string, fileName: string, fields: ClassField[], isUnion: boolean) {
        super();
        this.name = name;
        this.fileName = fileName;
        this.fullName = fullName;
        this.fields = fields;
        this.isComplete = true;
        this.fieldMap = new Map<string, ClassField>();
        this.isUnion = isUnion;
    }

    public buildFieldMap() {
        this.fieldMap = new Map<string, ClassField>(
            this.fields.map((x) => [x.name, x] as [string, ClassField]));
    }

    get length(): number {
        if (this.isUnion) {
            return Math.max(...this.fields
                .map((field) => field.type.length));
        } else {
            return this.fields
                .map((field) => field.type.length)
                .reduce((x, y) => x + y, 0);
        }
    }

    public toWType(): WType {
        throw new InternalError(`could not to Wtype of func`);
    }

    public toString() {
        return "[Class]";
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

    public compatWith(type: Type): boolean {
        return type === this;
    }
}
