/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {EmitError} from "../common/error";
import {doBinaryCompute, doUnaryCompute} from "./calculator";
import {
    BinaryOperator,
    Control, ConvertOperator,
    F32, F32Convert,
    F64, F64Convert, getTypeConvertOpe,
    I32, I32Convert,
    I64, I64Convert,
    OpTypeMap, UnaryOperator,
    WType,
    WTypeMap,
} from "./constant";
import {Emitter} from "./emitter";
import {getLeb128IntLength, getLeb128UintLength} from "./leb128";
import {getArrayLength, WExpression, WStatement} from "./node";

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

    public fold(): WExpression {
        this.argument = this.argument.map((x) => x.fold());
        return this;
    }

    public isPure(): boolean {
        return false;
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

    public fold(): WExpression {
        this.operand = this.operand.fold();
        if (this.operand instanceof WConst) {
            const type = OpTypeMap.get(this.ope)!;
            if (type === WType.f32 || type === WType.f64) {
                return new WConst(type,
                    doUnaryCompute(this.ope,
                        parseFloat(this.operand.constant)).toString());
            } else {
                return new WConst(type,
                    doUnaryCompute(this.ope,
                        parseInt(this.operand.constant)).toString());
            }
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.operand.isPure();
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

    public fold(): WExpression {
        this.lhs = this.lhs.fold();
        this.rhs = this.rhs.fold();
        if (this.lhs instanceof WConst && this.rhs instanceof WConst) {
            const type = OpTypeMap.get(this.ope)!;
            if (type === WType.f32 || type === WType.f64) {
                return new WConst(type,
                    doBinaryCompute(this.ope,
                        parseFloat(this.lhs.constant),
                        parseFloat(this.rhs.constant)).toString());
            } else {
                return new WConst(type,
                    doBinaryCompute(this.ope,
                        parseInt(this.lhs.constant),
                        parseInt(this.rhs.constant)).toString());
            }
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.lhs.isPure() && this.rhs.isPure();
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

    public fold(): WExpression {
        this.address = this.address.fold();
        return this;
    }

    public isPure(): boolean {
        return this.address.isPure();
    }
}

export class WGetLocal extends WExpression {
    public type: WType;
    public offset: number;

    constructor(type: WType, offset: number, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.offset = offset;
    }

    public emit(e: Emitter): void {
        e.writeByte(Control.get_local);
        e.writeUint32(this.offset);
    }

    public length(e: Emitter): number {
        return 1 + getLeb128UintLength(this.offset);
    }

    public deduceType(e: Emitter): WType {
        return this.type;
    }

    public fold(): WExpression {
        return this;
    }

    public isPure(): boolean {
        return true;
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

    public fold(): WExpression {
        return this;
    }

    public isPure(): boolean {
        return true;
    }
}

export class WCovertOperation extends WExpression {
    public srcType: WType;
    public dstType: WType;
    public ope: ConvertOperator;
    public operand: WExpression;

    constructor(srcType: WType, dstType: WType, operand: WExpression, ope: ConvertOperator, location?: SourceLocation) {
        super(location);
        this.srcType = srcType;
        this.dstType = dstType;
        this.operand = operand;
        this.ope = ope;
    }

    public emit(e: Emitter): void {
        this.operand.emit(e);
        e.writeByte(this.ope);
    }

    public deduceType(e: Emitter): WType {
        return this.dstType;
    }

    public length(e: Emitter): number {
        return this.operand.length(e) + 1;
    }

    public fold(): WExpression {
        this.operand = this.operand.fold();
        if (this.operand instanceof WConst) {
            if ( this.dstType === WType.f32 || this.dstType === WType.f64) {
                this.operand.constant = parseFloat(this.operand.constant).toString();
            } else {
                this.operand.constant = parseInt(this.operand.constant).toString();
            }
            return this.operand;
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.operand.isPure();
    }
}