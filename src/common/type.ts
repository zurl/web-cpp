import {InternalError} from "./error";
import {Assembly} from "./instruction";
import {isArrayEqual} from "./utils";

const MACHINE_POINTER_LENGTH = 4;

export abstract class Type {

    public isExtern: boolean;

    constructor() {
        this.isExtern = false;
    }

    abstract get length(): number;

    public equals(type: Type) {
        return this.constructor === type.constructor;
    }

    public abstract toString(): string;
}

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

export class PointerType extends CompoundType {
    public toString() {
        return this.elementType.toString() + "*";
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
}

export class RightReferenceType extends ReferenceType {
    public toString() {
        return this.elementType.toString() + "&&";
    }
}

export class QualifiedType extends CompoundType {
    public isConst: boolean;
    public isVolatile: boolean;

    constructor(elementType: Type, isConst: boolean, isVolatile: boolean) {
        super(elementType);
        this.isConst = isConst;
        this.isVolatile = isVolatile;
    }

    get length() {
        return this.elementType.length;
    }

    public toString(): string {
        if (this.isConst) {
            return "const " + this.elementType.toString();
        } else {
            return this.elementType.toString();
        }
    }

}

export abstract class PrimitiveType extends Type {
    public toString() {
        return this.constructor.name.replace("Type", "");
    }
}

export class VoidType extends PrimitiveType {
    get length(): number {
        return 1;
    }
}

export class NullptrType extends PrimitiveType {
    get length(): number {
        return 1;
    }
}

export abstract class ArithmeticType extends PrimitiveType {
}

export abstract class IntegerType extends ArithmeticType {
}

export abstract class FloatingType extends ArithmeticType {
}

export abstract class SignedIntegerType extends IntegerType {
}

export abstract class UnsignedIntegerType extends IntegerType {
}

export class BoolType extends UnsignedIntegerType {
    get length(): number {
        return 1;
    }
}

// HACK: Char = Signed Char
export class CharType extends SignedIntegerType {
    get length(): number {
        return 1;
    }
}

export class Int16Type extends SignedIntegerType {
    get length(): number {
        return 2;
    }
}

export class Int32Type extends SignedIntegerType {
    get length(): number {
        return 4;
    }
}

export class Int64Type extends SignedIntegerType {
    get length(): number {
        return 8;
    }
}

export class UnsignedCharType extends UnsignedIntegerType {
    get length(): number {
        return 1;
    }
}

export class UnsignedInt16Type extends UnsignedIntegerType {
    get length(): number {
        return 2;
    }
}

export class UnsignedInt32Type extends UnsignedIntegerType {
    get length(): number {
        return 4;
    }
}

export class UnsignedInt64Type extends UnsignedIntegerType {
    get length(): number {
        return 8;
    }
}

export class FloatType extends FloatingType {
    get length(): number {
        return 4;
    }
}

export class DoubleType extends FloatingType {
    get length(): number {
        return 8;
    }
}

export class FunctionType extends Type {
    public name: string;
    public returnType: Type;
    public parameterTypes: Type[];
    public parameterNames: string[];

    constructor(name: string, returnType: Type, parameterTypes: Type[], parameterNames: string[]) {
        super();
        this.name = name;
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
        this.parameterNames = parameterNames;
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
}

enum AccessControl {
    Public,
    Private,
    Protected,
}

export class ClassType extends Type {
    get length(): number {
        return 0;
    }

    public toString() {
        return "[Class]";
    }
}

// export class MemberFunctionType extends FunctionType{
//     classType: Type;
//     isStatic: boolean;
//     isVirtual: boolean;
//     accessControl: AccessControl;
// }
//
// export class FieldType extends Type{
//     name: string;
//     type: Type;
//     isStatic: boolean;
//     accessControl: AccessControl;
//
// }
//
//
// export class ClassType extends Type{
//     name: string;
//     methods: MemberFunctionType[];
//     fields: FieldType[];
//     baseClasses: Type[];
//
//     requireVTable(): boolean{
//         return false;
//     }
//
// }

// class EnumType extends Type{
//
// }
//
// class UnionType extends Type{
//
// }
//

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
}

export const PrimitiveTypes = {
    void: new VoidType(),
    nullptr: new NullptrType(),
    bool: new BoolType(),
    char: new CharType(),
    uchar: new UnsignedCharType(),
    int16: new Int16Type(),
    uint16: new UnsignedInt16Type(),
    int32: new Int32Type(),
    uint32: new UnsignedInt32Type(),
    int64: new Int64Type(),
    uint64: new UnsignedInt64Type(),
    float: new FloatType(),
    double: new DoubleType(),
};

export const PrimitiveTypesNameMap = new Map<string[][], PrimitiveType>([
    [[["void"]], PrimitiveTypes.void],
    [[["bool"]], PrimitiveTypes.bool],
    [[["char"], ["signed", "char"].sort()], PrimitiveTypes.char],
    [[["unsigned", "char"].sort()], PrimitiveTypes.uchar],
    [[["short"], ["signed", "short"].sort(), ["short", "int"].sort(), ["signed", "short", "int"].sort()],
        PrimitiveTypes.int16],
    [[["unsigned", "short"].sort(), ["unsigned", "short", "int"].sort()], PrimitiveTypes.uint16],
    [[["int"], ["signed"], ["signed", "int"].sort()], PrimitiveTypes.int32],
    [[["unsigned"], ["unsigned", "int"].sort()], PrimitiveTypes.uint32],
    [[["long"], ["signed", "long"].sort(), ["long", "int"].sort(), ["signed", "long", "int"].sort()],
        PrimitiveTypes.int32],
    [[["unsigned", "long"].sort(), ["unsigned", "long", "int"].sort()], PrimitiveTypes.uint32],
    [[["long", "long"], ["signed", "long", "long"].sort(), ["long", "long", "int"].sort(),
        ["signed", "long", "long", "int"].sort()], PrimitiveTypes.int64],
    [[["unsigned", "long", "long"].sort(), ["unsigned", "long", "long", "int"].sort()],
        PrimitiveTypes.uint64],
    [[["float"]], PrimitiveTypes.float],
    [[["double"]], PrimitiveTypes.double],
    // [[['long', 'double'].sort()],                                               PrimitiveTypes.longDouble],
    // [[['_Bool']],                                                               PrimitiveTypes._Bool]
]);

/**
 * C语言 运算类型提取
 * 1. 把引用转普通
 * 2. 数组转指针
 * @param {Type} rawType
 * @returns {Type}
 */
export function extractRealType(rawType: Type) {
    if (rawType instanceof ArrayType) {
        return new PointerType(rawType.elementType);
    } else if (rawType instanceof ReferenceType) {
        return rawType.elementType;
    } else {
        return rawType;
    }
}
