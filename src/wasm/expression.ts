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
    F64, F64Convert, getNativeType, getOperationType, getTypeConvertOpe,
    I32, I32Binary, I32Convert,
    I64, I64Convert, OpCodes,
    OpTypeMap, UnaryOperator,
    WType,
    WTypeMap,
} from "./constant";
import {Emitter} from "./emitter";
import {getLeb128IntLength, getLeb128UintLength} from "./leb128";
import {getArrayLength, WExpression, WStatement} from "./node";

export function getAlign(number: number) {
    return 0;
}

export class WFakeExpression extends WExpression {
    public statement: WStatement;

    constructor(statement: WStatement, location?: SourceLocation) {
        super(location);
        this.statement = statement;
    }

    public deduceType(e: Emitter): WType {
        throw new EmitError(`internal error`);
    }

    public emit(e: Emitter): void {
        this.statement.emit(e);
    }

    public fold(): WExpression {
        return this;
    }

    public isPure(): boolean {
        return false;
    }

    public length(e: Emitter): number {
        return this.statement.length(e);
    }

    public dump(e: Emitter): void {
        this.statement.dump(e);
    }

}

export class WCall extends WExpression {
    public target: string;
    public argument: WExpression[];
    public afterStatements: WStatement[];

    constructor(target: string, argument: WExpression[], afterStatements: WStatement[], location?: SourceLocation) {
        super(location);
        this.target = target;
        this.argument = argument;
        this.afterStatements = afterStatements;
    }

    public emit(e: Emitter): void {
        this.argument.map((x) => x.emit(e));
        e.writeByte(Control.call);
        e.writeUint32(e.getFuncIdx(this.target));
        this.afterStatements.map((x) => x.emit(e));
    }

    public length(e: Emitter): number {
        return getArrayLength(this.argument, (x) => x.length(e)) +
            getArrayLength(this.afterStatements, (x) => x.length(e)) +
            1 + getLeb128UintLength(e.getFuncIdx(this.target));
    }

    public deduceType(e: Emitter): WType {
        const funcType = e.getFuncType(this.target);
        const arguTypes = this.argument
            .filter((x) => ! (x instanceof WFakeExpression))
            .map((x) => x.deduceType(e));
        if (funcType.parameters.map((x) => getNativeType(x)).join(",")
            !== arguTypes.map((x) => getNativeType(x)).join(",")) {
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

    public dump(e: Emitter): void {
        this.argument.map((x) => x.dump(e));
        e.dump(`call ${this.target}`, this.location);
        this.afterStatements.map((x) => x.dump(e));
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
        if ( getNativeType(this.operand.deduceType(e)) !== OpTypeMap.get(this.ope)) {
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

    public dump(e: Emitter): void {
        this.operand.dump(e);
        e.dump(`${OpCodes.get(this.ope)}`, this.location);
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
        const lhs = getNativeType(this.lhs.deduceType(e));
        const rhs = getNativeType(this.rhs.deduceType(e));
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

    public dump(e: Emitter): void {
        this.lhs.dump(e);
        this.rhs.dump(e);
        e.dump(`${OpCodes.get(this.ope)}`, this.location);
    }

    public isPure(): boolean {
        return this.lhs.isPure() && this.rhs.isPure();
    }
}

export enum WMemoryLocation {
    RAW,
    DATA,
    BSS,
    EXTERN,
}

export class WLoad extends WExpression {
    public type: WType;
    public address: WExpression;
    public offset: number;
    public offsetName: string;
    public form: WMemoryLocation;

    constructor(type: WType, address: WExpression,
                form: WMemoryLocation = WMemoryLocation.RAW, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.address = address;
        this.form = form;
        this.offset = 0;
        this.offsetName = "";
    }

    public getOp() {
        switch (this.type) {
            case WType.u8: return I32.load8_u;
            case WType.u16: return I32.load16_u;
            case WType.i8: return I32.load8_s;
            case WType.i16: return I32.load16_s;
            case WType.i32:
            case WType.u32: return I32.load;
            case WType.f32: return F32.load;
            case WType.f64: return F64.load;
            case WType.i64:
            case WType.u64: return I64.load;
        }
    }

    public emit(e: Emitter): void {
        let offset = this.offset;
        if ( this.form === WMemoryLocation.DATA ) {
            offset += e.getCurrentFunc().dataStart;
        } else if ( this.form === WMemoryLocation.BSS ) {
            offset += e.getCurrentFunc().bssStart;
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            offset += e.getExternLocation(this.offsetName);
        }
        if ( offset < 0 ) {
            this.replaceAddress();
            offset = 0;
        }
        this.address.emit(e);
        e.writeByte(this.getOp() as number);
        e.writeUint32(getAlign(offset));
        e.writeUint32(offset);
    }

    public length(e: Emitter): number {
        let offset = this.offset;
        if ( this.form === WMemoryLocation.DATA ) {
            offset += e.getCurrentFunc().dataStart;
        } else if ( this.form === WMemoryLocation.BSS ) {
            offset += e.getCurrentFunc().bssStart;
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            offset += e.getExternLocation(this.offsetName);
        }
        if ( offset < 0 ) {
            this.replaceAddress();
            offset = 0;
        }
        return this.address.length(e) + getLeb128UintLength(getAlign(offset)) +
            getLeb128UintLength(offset) + 1;

    }

    public replaceAddress() {
        this.address = new WBinaryOperation(I32Binary.add,
            this.address,
            new WConst(WType.i32, this.offset.toString()),
            this.location);
        this.offset = 0;
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

    public dump(e: Emitter): void {
        this.address.dump(e);
        e.dump(`${OpCodes.get(this.getOp() as number)}`, this.location);
    }
}

export class WGetGlobal extends WExpression {
    public type: WType;
    public name: string;

    constructor(type: WType, name: string, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.writeByte(Control.get_global);
        e.writeUint32(e.getGlobalIdx(this.name));
    }

    public length(e: Emitter): number {
        return 1 + getLeb128UintLength(e.getGlobalIdx(this.name));
    }

    public deduceType(e: Emitter): WType {
        if ( this.type !== e.getGlobalType(this.name)) {
            throw new EmitError(`type mismatch at getglobal`);
        }
        return this.type;
    }

    public fold(): WExpression {
        return this;
    }

    public isPure(): boolean {
        return true;
    }

    public dump(e: Emitter): void {
        e.dump(`get_global ${this.name}`, this.location);
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

    public dump(e: Emitter): void {
        e.dump(`get_local $${this.offset}`, this.location);
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
        switch (getNativeType(this.type)) {
            case WType.i32:
                e.writeByte(I32.const);
                e.writeInt32(parseInt(this.constant));
                break;
            case WType.i64:
                e.writeByte(I64.const);
                e.writeInt64(this.constant.split(".")[0]);
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
        switch (getNativeType(this.type)) {
            case WType.i32:
            case WType.i64:
                return 1 + getLeb128IntLength(this.constant.split(".")[0]);
            case WType.f32:
                return 5;
            case WType.f64:
                return 9;
        }
        throw new EmitError(`unsupport type`);
    }

    public fold(): WExpression {
        return this;
    }

    public isPure(): boolean {
        return true;
    }

    public dump(e: Emitter): void {
        e.dump(`${WType[this.type]}.const ${this.constant}`, this.location);
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
            this.operand.type = this.dstType;
            return this.operand;
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.operand.isPure();
    }

    public dump(e: Emitter): void {
        this.operand.dump(e);
        e.dump(OpCodes.get(this.ope as number)!, this.location);
    }
}

export class WGetAddress extends WExpression {
    public form: WMemoryLocation;
    public offset: number;
    public offsetName: string;

    constructor(form: WMemoryLocation, location?: SourceLocation) {
        super(location);
        this.form = form;
        this.offset = 0;
        this.offsetName = "";
    }

    public emit(e: Emitter): void {
        e.writeByte(I32.const);
        let offset = this.offset;
        if ( this.form === WMemoryLocation.DATA ) {
            offset += e.getCurrentFunc().dataStart;
        } else if ( this.form === WMemoryLocation.BSS ) {
            offset += e.getCurrentFunc().bssStart;
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            offset += e.getExternLocation(this.offsetName);
        }
        e.writeUint32(offset);
    }

    public length(e: Emitter): number {
        let offset = this.offset;
        if ( this.form === WMemoryLocation.DATA ) {
            offset += e.getCurrentFunc().dataStart;
        } else if ( this.form === WMemoryLocation.BSS ) {
            offset += e.getCurrentFunc().bssStart;
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            offset += e.getExternLocation(this.offsetName);
        }
        return getLeb128UintLength(offset) + 1;
    }

    public deduceType(e: Emitter): WType {
        return WType.i32;
    }

    public fold(): WExpression {
        return this;
    }

    public isPure(): boolean {
        return true;
    }

    public dump(e: Emitter): void {
        if ( this.form === WMemoryLocation.DATA ) {
            e.dump(`get_data ${this.offset}`, this.location);
        } else if ( this.form === WMemoryLocation.BSS ) {
            e.dump(`get_bss ${this.offset}`, this.location);
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            e.dump(`get_extern ${this.offsetName}`, this.location);
        } else {
            e.dump(`get_raw $${this.offset}`, this.location);
        }
    }
}
