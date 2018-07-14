/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {EmitError} from "../common/error";
import {
    BinaryOperator,
    Control,
    F32,
    F32Binary,
    F32Unary,
    F64,
    F64Binary,
    F64Unary,
    I32,
    I32Binary,
    I32Unary,
    I64,
    I64Binary,
    I64Unary, OpTypeMap, UnaryOperator,
    WType,
    WTypeMap,
} from "./constant";
import {Emitter} from "./emitter";
import {i32} from "./index";
import {getLeb128IntLength, getLeb128UintLength} from "./leb128";
import {getArrayLength, WExpression} from "./node";

export function getAlign(number: number) {
    const i = number % 4;
    if (i === 0) {
        return 2;
    } else if (i === 1) {
        return 0;
    } else if (i === 2) {
        return 1;
    } else {
        return 0;
    }
}

export class WCall extends WExpression {
    public target: string;
    public argument: WExpression[];

    constructor(target: string, argument: WExpression[], location?: SourceLocation) {
        super(location);
        this.target = target;
        this.argument = argument;
    }

    public emit(e: Emitter): void {
        this.argument.map((x) => x.emit(e));
        e.writeByte(Control.call);
        e.writeUint32(e.getFuncIdx(this.target));
    }

    public length(e: Emitter): number {
        return getArrayLength(this.argument, (x) => x.length(e)) +
            1 + getLeb128UintLength(e.getFuncIdx(this.target));
    }

    public deduceType(e: Emitter): WType {
        const funcType = e.getFuncType(this.target);
        const arguTypes = this.argument.map((x) => x.deduceType(e));
        if (funcType.returnTypes.join(",") !== arguTypes.join(",")) {
            throw new EmitError(`type mismatch at call`);
        }
        if (funcType.returnTypes.length === 0) {
            return WType.none;
        } else {
            return funcType.returnTypes[0];
        }
    }

}

export class WUnaryOperation extends WExpression {
    public ope: UnaryOperator;
    public operand: WExpression;

    constructor(ope: UnaryOperator, operand: WExpression, location?: SourceLocation) {
        super(location);
        this.ope = ope;
        this.operand = operand;
    }

    public emit(e: Emitter): void {
        this.operand.emit(e);
        e.writeByte(this.ope);
    }

    public length(e: Emitter): number {
        return this.operand.length(e) + 1;
    }

    public deduceType(e: Emitter): WType {
        if ( this.operand.deduceType(e) !== OpTypeMap.get(this.ope)) {
            throw new EmitError(`type mismatch at unary ope`);
        }
        return this.operand.deduceType(e);
    }
}

export class WBinaryOperation extends WExpression {
    public ope: BinaryOperator;
    public lhs: WExpression;
    public rhs: WExpression;

    constructor(ope: BinaryOperator, lhs: WExpression, rhs: WExpression, location?: SourceLocation) {
        super(location);
        this.ope = ope;
        this.lhs = lhs;
        this.rhs = rhs;
    }

    public emit(e: Emitter): void {
        this.lhs.emit(e);
        this.rhs.emit(e);
        e.writeByte(this.ope);
    }

    public length(e: Emitter): number {
        return this.lhs.length(e) + this.rhs.length(e) + 1;
    }

    public deduceType(e: Emitter): WType {
        const lhs = this.lhs.deduceType(e);
        const rhs = this.rhs.deduceType(e);
        if (lhs !== rhs || OpTypeMap.get(this.ope) !== lhs) {
            throw new EmitError(`type mismatch in binaryope`);
        }
        return lhs;
    }
}

export class WLoad extends WExpression {
    public type: WType;
    public address: WExpression;
    public offset: number;

    constructor(type: WType, address: WExpression, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.address = address;
        this.offset = 0;
    }

    public emit(e: Emitter): void {
        this.address.emit(e);
        e.writeByte((WTypeMap.get(this.type) as any)["load"]);
        e.writeUint32(getAlign(this.offset));
        e.writeUint32(this.offset);
    }

    public length(e: Emitter): number {
        return this.address.length(e) + getLeb128UintLength(getAlign(this.offset)) +
            getLeb128UintLength(this.offset) + 1;
    }

    public deduceType(e: Emitter): WType {
        return this.type;
    }
}

export class WConst extends WExpression {
    public type: WType;
    public constant: string;

    constructor(type: WType, constant: string, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.constant = constant;
    }

    public emit(e: Emitter): void {
        switch (this.type) {
            case WType.i32:
                e.writeByte(I32.const);
                e.writeInt32(parseInt(this.constant));
                break;
            case WType.i64:
                e.writeByte(I64.const);
                e.writeInt64(parseInt(this.constant));
                break;
            case WType.f32:
                e.writeByte(F32.const);
                e.writeFloat32(parseFloat(this.constant));
                break;
            case WType.f64:
                e.writeByte(F64.const);
                e.writeFloat64(parseFloat(this.constant));
                break;
        }
    }

    public deduceType(e: Emitter): WType {
        return this.type;
    }

    public length(e: Emitter): number {
        switch (this.type) {
            case WType.i32:
                return 1 + getLeb128IntLength(parseInt(this.constant));
            case WType.u32:
                return 1 + getLeb128UintLength(parseInt(this.constant));
            case WType.f32:
                return 5;
            case WType.f64:
                return 9;
        }
        return Number.MAX_SAFE_INTEGER;
    }

}
