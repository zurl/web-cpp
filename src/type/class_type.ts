/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {WAddressHolder} from "../codegen/address";
import {CompileContext} from "../codegen/context";
import {ObjectInitializer} from "../codegen/declaration/object_initializer";
import {AnonymousExpression} from "../codegen/expression/anonymous_expression";
import {AssignmentExpression} from "../codegen/expression/assignment_expression";
import {Expression} from "../codegen/expression/expression";
import {FunctionLookUpResult} from "../codegen/scope";
import {ExpressionStatement} from "../codegen/statement/expression_statement";
import {InternalError} from "../common/error";
import {Node} from "../common/node";
import {AddressType, Variable} from "../common/symbol";
import {WType} from "../wasm";
import {WGetAddress, WGetFunctionAddress, WMemoryLocation} from "../wasm/expression";
import {AccessControl, Type} from "./index";
import {PrimitiveTypes} from "./primitive_type";
import {ClassTemplate} from "./template_type";

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

export interface VirtualTableItem {
    indexName: string;
    fullName: string;
}

export interface VirtualTable {
    className: string;
    vFunctions: VirtualTableItem[];
}

export class ClassType extends Type {

    public shortName: string;
    public fullName: string;
    public fileName: string;

    public fields: ClassField[];
    public fieldMap: Map<string, ClassField>;

    public isUnion: boolean;
    public isComplete: boolean;
    public inheritance: Inheritance[];

    // only use in build
    public fieldOffset: number;
    public accessControl: AccessControl;

    // fill in initialize
    public selfSize: number;
    public objectSize: number;

    // vptr settings
    public requireVPtr: boolean;
    public VPtrOffset: number;
    public vTable: VirtualTable;
    public vTablePtr: number;

    constructor(shortName: string, fullName: string, fileName: string,
                fields: ClassField[], isUnion: boolean, inheritance: Inheritance[]) {
        super();
        this.shortName = shortName;
        this.fileName = fileName;
        this.fullName = fullName;
        this.fields = fields;
        this.isComplete = false;
        this.fieldMap = new Map<string, ClassField>();
        this.isUnion = isUnion;
        this.inheritance = inheritance;
        this.selfSize = 0;
        this.vTablePtr = 0;
        this.objectSize = this.inheritance.map(
            (x) => x.classType.length).reduce((x, y) => x + y, 0);
        this.requireVPtr = false;
        this.VPtrOffset = 0;
        this.fieldOffset = 0;
        this.accessControl = AccessControl.Public;
        this.vTable = {
            className: fullName,
            vFunctions: [],
        };
    }

    public initialize() {
        this.fieldMap = new Map<string, ClassField>(
            this.fields.map((x) => [x.name, x] as [string, ClassField]));
        if (this.isUnion) {
            this.selfSize += Math.max(...this.fields
                .map((field) => field.type.length));
        } else {
            this.selfSize += this.fields
                .map((field) => field.type.length)
                .reduce((x, y) => x + y, 0);
        }
        this.objectSize = this.selfSize + this.inheritance.map(
            (x) => x.classType.length).reduce((x, y) => x + y, 0);
        this.isComplete = true;
    }

    get length(): number {
        if (!this.isComplete) {
            throw new InternalError(`class ${this.shortName} is incomplete`);
        }
        return this.objectSize;
    }

    public toWType(): WType {
        throw new InternalError(`could not to Wtype of func`);
    }

    public toString() {
        return this.shortName;
    }

    public toMangledName() {
        return "$" + this.fullName.replace(/::/g, "!!") + "$";
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
            throw new InternalError(`class ${this.shortName} is incomplete`);
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
        const item = ctx.scopeManager.lookup(this.fullName + "::" + name);
        if (item !== null) {
            if (item instanceof Type || item instanceof ClassTemplate) {
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

    public setUpVPtr() {
        let off = 0;
        for (const parent of this.inheritance) {
            if (parent.classType.requireVPtr) {
                this.requireVPtr = true;
                this.VPtrOffset = parent.classType.VPtrOffset + off;
                parent.classType.vTable.vFunctions.map((item) =>
                    this.vTable.vFunctions.push({
                    indexName: item.indexName,
                    fullName: item.fullName,
                }));
                break;
            }
            off += parent.classType.objectSize;
        }
        if ( !this.requireVPtr ) {
            this.requireVPtr = true;
            this.VPtrOffset = this.objectSize;
            this.objectSize += 4;
            this.selfSize += 4;
        }
    }

    public registerVFunction(ctx: CompileContext, indexName: string, fullName: string) {
        const oldItems = this.vTable.vFunctions.filter((x) => x.indexName === indexName);
        if ( oldItems.length === 0) {
            this.vTable.vFunctions.push({
                indexName,
                fullName,
            });
        } else {
            oldItems[0].fullName = fullName;
        }
    }


    public getVCallInfo(indexName: string): [number, number] | null {
        for (let i = 0; i < this.vTable.vFunctions.length; i++) {
            if ( this.vTable.vFunctions[i].indexName === indexName) {
                return [this.VPtrOffset, i * 4];
            }
        }
        let nowOffset = 0;
        for ( const parent of this.inheritance ) {
            const vFuncs = parent.classType.vTable.vFunctions;
            for (let i = 0; i < vFuncs.length; i++) {
                if ( vFuncs[i].indexName === indexName) {
                    return [parent.classType.VPtrOffset, i * 4];
                }
            }
            nowOffset += parent.classType.objectSize;
        }
        return null;
    }
}
