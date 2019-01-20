/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {FunctionLookUpResult} from "../codegen/scope";
import {InternalError} from "../common/error";
import {isArrayEqual} from "../common/utils";
import {getNativeType, WType} from "../wasm/constant";
import {WFunctionType} from "../wasm/section";
import {ClassType} from "./class_type";
import {ArrayType, PointerType} from "./compound_type";
import {Type} from "./index";
import {PrimitiveTypes} from "./primitive_type";

export enum CppFunctionType {
    Normal,
    Constructor,
    Destructor,
    MemberFunction,
}

export class TemplatePlaceholderType extends Type {

    public index: number;

    constructor(index: number) {
        super();
        this.index = index;
    }

    get length(): number {
        throw new InternalError("unexpected");
    }

    public toMangledName(): string {
        return "^$" + this.index + "^";
    }

    public toWType(): WType {
        throw new InternalError("unexpected");
    }

    public toString(): string {
        return `[${this.index}]`;
    }
}

export class FunctionType extends Type {
    // coretype
    public isVirtual: boolean;
    public returnType: Type;
    public parameterTypes: Type[];
    public variableArguments: boolean;
    public cppFunctionType: CppFunctionType;
    public referenceClass: ClassType | null;
    constructor(returnType: Type, parameterTypes: Type[], variableArguments: boolean = false) {
        super();
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
        this.variableArguments = variableArguments;
        this.cppFunctionType = CppFunctionType.Normal;
        this.isVirtual = false;
        this.referenceClass = null;
        for (let i = 0; i < this.parameterTypes.length; i++) {
            const ty = this.parameterTypes[i];
            if (ty instanceof ArrayType) {
                this.parameterTypes[i] = new PointerType(ty.elementType);
            }
        }
    }

    get length(): number {
        return 0;
    }

    public equals(type: Type): boolean {
        return super.equals(type) &&
            type instanceof FunctionType &&
            this.returnType.equals(type.returnType) &&
            isArrayEqual(this.parameterTypes, type.parameterTypes);
    }

    public toDisplayString(name: string) {
        if (name.charAt(0) === "#") {
            if (name.charAt(1) === "$") {
                name = name.substring(2);
            } else {
                name = "operator" + name.substring(1);
            }
        }
        if (name.includes("@")) {
            const tokens = name.split("@");
            name = tokens[0] + "<" + tokens[2] + ">";
        }
        if (this.cppFunctionType === CppFunctionType.Constructor) {
            name = this.referenceClass!.shortName + "::" + this.referenceClass!.shortName;
        } else if (this.cppFunctionType === CppFunctionType.Destructor) {
            name = "~" + this.referenceClass!.shortName + "::" + this.referenceClass!.shortName;
        } else if (this.cppFunctionType === CppFunctionType.MemberFunction) {
            name = this.referenceClass!.shortName + "::" + name;
        }
        return this.returnType.toString() + " " + name + "(" +
            this.parameterTypes.map((x) => x.toString()).join(", ") + ")";
    }

    public toString() {
        return this.returnType.toString() + "(" +
            this.parameterTypes.map((x) => x.toString()).join(", ") + ")";
    }

    public toWType(): WType {
        throw new InternalError(`could not to Wtype of func`);
    }

    public toMangledName(): string {
        return this.parameterTypes.map((x) => x.toMangledName()).join(",");
    }
/*
    public toIndexName(): string {
        if (this.cppFunctionType === CppFunctionType.Destructor) {
            return "~";
        }
        return this.shortName + "@" + this.parameterTypes.slice(1).map((x) => x.toMangledName()).join(",");
    }*/

    public compatWith(type: Type): boolean {
        return type.equals(this);
    }

    public isMemberFunction(): boolean {
        return this.cppFunctionType === CppFunctionType.Destructor
            || this.cppFunctionType === CppFunctionType.MemberFunction;
    }

    public toWASMEncoding(): string {
        let result = "";
        if (!this.returnType.equals(PrimitiveTypes.void) && !(this.returnType instanceof ClassType)) {
            result += WFunctionType.n2s(getNativeType(this.returnType.toWType()));
        } else {
            result += "v";
        }
        this.parameterTypes.filter((ty) => !(ty instanceof ClassType))
            .map((ty) => result += WFunctionType.n2s(getNativeType(ty.toWType())));
        return result;
    }
}

export class UnresolvedFunctionOverloadType extends Type {

    public functionLookupResult: FunctionLookUpResult;

    constructor(functionLookupResult: FunctionLookUpResult) {
        super();
        this.functionLookupResult = functionLookupResult;
    }

    public equals(type: Type) {
        return false;
    }

    public compatWith(type: Type) {
        return false;
    }

    public toString() {
        return `[UnresolveFunctionOverloadType]`;
    }

    public get length() {
        return 0;
    }

    public toWType(): WType {
        throw new InternalError(`UnresolveFunctionOverloadType()`);
    }

    public toMangledName() {
        return `[UnresolveFunctionOverloadType]`;
    }
}
