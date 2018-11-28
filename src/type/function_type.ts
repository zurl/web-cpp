/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 05/08/2018
 */

import {FunctionLookUpResult} from "../codegen/scope";
import {ConstructorInitializeItem} from "../common/ast";
import {InternalError} from "../common/error";
import {isArrayEqual} from "../common/utils";
import {getNativeType, WType} from "../wasm/constant";
import {ClassType} from "./class_type";
import {ArrayType, PointerType} from "./compound_type";
import {Type} from "./index";
import {PrimitiveTypes} from "./primitive_type";
import {WFunctionType} from "../wasm/section";

export enum CppFunctionType {
    Normal,
    Constructor,
    Destructor,
    MemberFunction,
}

export class FunctionType extends Type {
    public name: string;
    public returnType: Type;
    public parameterTypes: Type[];
    public parameterNames: string[];
    public variableArguments: boolean;
    public cppFunctionType: CppFunctionType;
    public referenceClass: ClassType | null;
    public initList: ConstructorInitializeItem[];

    constructor(name: string, returnType: Type, parameterTypes: Type[],
                parameterNames: string[], variableArguments: boolean) {
        super();
        this.name = name;
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
        this.parameterNames = parameterNames;
        this.variableArguments = variableArguments;
        this.cppFunctionType = CppFunctionType.Normal;
        this.referenceClass = null;
        this.initList = [];
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

    public toString() {
        return "[Function]";
    }

    public toWType(): WType {
        throw new InternalError(`could not to Wtype of func`);
    }

    public toMangledName(): string {
        return this.parameterTypes.map((x) => x.toMangledName()).join(",");
    }

    public toIndexName(): string {
        if (this.cppFunctionType === CppFunctionType.Destructor) {
            return "~";
        }
        return this.name + "@" + this.parameterTypes.slice(1).map((x) => x.toMangledName()).join(",");
    }

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
