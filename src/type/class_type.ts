/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {AccessControl, Type} from ".";
import {WAddressHolder} from "../codegen/address";
import {CompileContext} from "../codegen/context";
import {FunctionLookUpResult} from "../codegen/scope";
import {
    AnonymousExpression,
    AssignmentExpression,
    Expression,
    ExpressionStatement,
    Identifier,
    IntegerConstant,
    Node, ObjectInitializer, SubscriptExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {AddressType, Variable} from "../common/symbol";
import {WType} from "../wasm";
import {WGetAddress, WGetFunctionAddress, WMemoryLocation} from "../wasm/expression";
import {PointerType} from "./compound_type";
import {FunctionType} from "./function_type";
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

export interface VirtualTableItem {
    indexName: string;
    fullName: string;
}

export interface VirtualTable {
    className: string;
    vFunctions: VirtualTableItem[];
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
    public vTable: VirtualTable;
    public vTablePtr: number;

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
        this.selfSize = 0;
        this.vTablePtr = 0;
        this.objectSize = this.inheritance.map(
            (x) => x.classType.length).reduce((x, y) => x + y, 0);
        this.requireVPtr = false;
        this.VPtrOffset = 0;
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

    public registerVFunction(ctx: CompileContext, functionType: FunctionType) {
        const indexName = functionType.toIndexName();
        const fullName = ctx.scopeManager.getFullName(functionType.name + "@" + functionType.toMangledName());
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

    public generateVTable(ctx: CompileContext, node: Node) {
        const vTablesize = 4 * this.vTable.vFunctions.length;
        this.vTablePtr = ctx.memory.allocData(vTablesize);
        for (let i = 0; i < this.vTable.vFunctions.length; i++) {
            const vTablePtrExpr = new WGetAddress(WMemoryLocation.DATA, node.location);
            vTablePtrExpr.offset = this.vTablePtr + i * 4;
            const vTableExpr = new AnonymousExpression(node.location, {
                type: PrimitiveTypes.int32,
                expr: new WAddressHolder(vTablePtrExpr, AddressType.RVALUE, node.location),
                isLeft: true,
            });
            const vFuncName = this.vTable.vFunctions[i].fullName;
            new ExpressionStatement(node.location, new AssignmentExpression(node.location,
                "=",
                vTableExpr,
                new AnonymousExpression(node.location, {
                    type: PrimitiveTypes.int32,
                    isLeft: false,
                    expr: new WGetFunctionAddress(vFuncName, node.location),
                }))).codegen(ctx);
        }
    }

    public getVCallInfo(indexName: string): [number, number] | null{
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
