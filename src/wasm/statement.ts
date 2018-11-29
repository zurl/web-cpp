/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {EmitError} from "../common/error";
import {Control, F32, F64, getNativeType, I32, I32Binary, I64, OpCodes, WType, WTypeMap} from "./constant";
import {Emitter, JSONEmitter} from "./emitter";
import {getAlign, WBinaryOperation, WCall, WConst, WMemoryLocation} from "./expression";
import {getLeb128UintLength} from "./leb128";
import {getArrayLength, WExpression, WStatement} from "./node";

export class WReturn extends WStatement {
    public expr: WExpression | null;

    constructor(expr: WExpression | null, location?: SourceLocation) {
        super(location);
        this.expr = expr;
        if (expr !== null) {
            this.expr = expr;
        }
    }

    public emit(e: Emitter): void {
        const curFunc = e.getCurrentFunc();
        if ( curFunc.type.returnTypes.length === 0 && this.expr !== null) {
            throw new EmitError(`type mismatch at WReturn`);
        }
        if ( curFunc.type.returnTypes.length !== 0) {
            if (this.expr === null) {
                throw new EmitError(`type mismatch at WReturn`);
            }
            const exprType = this.expr.deduceType(e);
            if (getNativeType(exprType) !== getNativeType(curFunc.type.returnTypes[0])) {
                throw new EmitError(`type mismatch at WReturn`);
            }
        }
        if (this.expr !== null) {
            this.expr.emit(e);
        }
        e.writeByte(Control.return);
    }

    public emitJSON(e: JSONEmitter): void {
        const curFunc = e.getCurrentFunc();
        if ( curFunc.type.returnTypes.length === 0 && this.expr !== null) {
            throw new EmitError(`type mismatch at WReturn`);
        }
        if ( curFunc.type.returnTypes.length !== 0) {
            if (this.expr === null) {
                throw new EmitError(`type mismatch at WReturn`);
            }
            const exprType = this.expr.deduceType(e);
            if (getNativeType(exprType) !== getNativeType(curFunc.type.returnTypes[0])) {
                throw new EmitError(`type mismatch at WReturn`);
            }
        }
        if (this.expr !== null) {
            this.expr.emitJSON(e);
        }
        e.emitIns([Control.return, 0, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        if (this.expr !== null) {
            return this.expr.length(e) + 1;
        }
        return 1;
    }

    public dump(e: Emitter): void {
        if (this.expr !== null) {
            this.expr.dump(e);
        }
        e.dump(`return`);
    }

    public optimize(e: Emitter): void {
        if (this.expr !== null) {
            this.expr = this.expr.fold();
            this.expr.optimize(e);
        }
    }

}

export class WStore extends WStatement {
    public type: WType;
    public address: WExpression;
    public value: WExpression;
    public offset: number;
    public form: WMemoryLocation;
    public offsetName: string;

    constructor(type: WType,
                address: WExpression, value: WExpression,
                form: WMemoryLocation = WMemoryLocation.RAW, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.address = address;
        this.value = value;
        this.offset = 0;
        this.form = form;
        this.offsetName = "";
    }

    public getOp() {
        switch (this.type) {
            case WType.u8:
            case WType.i8: return I32.store8;
            case WType.i16:
            case WType.u16: return I32.store16;
            case WType.i32:
            case WType.u32: return I32.store;
            case WType.f32: return F32.store;
            case WType.f64: return F64.store;
            case WType.i64:
            case WType.u64: return I64.store;
        }
    }

    public emit(e: Emitter): void {
        const offset = this.computeOffset(e);
        this.address.emit(e);
        this.value.emit(e);
        e.writeByte(this.getOp() as number);
        e.writeUint32(getAlign(offset));
        e.writeUint32(offset);
    }

    public emitJSON(e: JSONEmitter): void {
        const offset = this.computeOffset(e);
        this.address.emitJSON(e);
        this.value.emitJSON(e);
        e.emitIns([this.getOp() as number, offset, this.getStartLine()]);
    }

    public replaceAddress() {
        this.address = new WBinaryOperation(I32Binary.add,
            this.address,
            new WConst(WType.i32, this.offset.toString()),
            this.location);
        this.offset = 0;
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
        return this.address.length(e) + this.value.length(e) +
            getLeb128UintLength(getAlign(offset)) +
            getLeb128UintLength(offset) + 1;
    }

    public dump(e: Emitter): void {
        this.address.dump(e);
        this.value.dump(e);
        e.dump(`${OpCodes.get(this.getOp() as number)}`, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
        this.address = this.address.fold();
        this.address.optimize(e);
    }

    private computeOffset(e: Emitter): number {
        if (getNativeType(this.value.deduceType(e)) !== getNativeType(this.type)) {
            throw new EmitError(`type mismatch at store: ${this.value.deduceType(e)} and ${this.type}`);
        }
        if ( this.address.deduceType(e) !== WType.u32 && this.address.deduceType(e) !== WType.i32 ) {
            throw new EmitError(`type mismatch at store, address`);
        }
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
        return offset;
    }

}
export class WSetLocal extends WStatement {
    public type: WType;
    public offset: number;
    public value: WExpression;

    constructor(type: WType, offset: number, value: WExpression, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.offset = offset;
        this.value = value;
    }

    public emit(e: Emitter): void {
        this.value.emit(e);
        e.writeByte(Control.set_local);
        e.writeUint32(this.offset);
    }

    public emitJSON(e: JSONEmitter): void {
        this.value.emitJSON(e);
        e.emitIns([Control.set_local, this.offset, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return this.value.length(e) + 1 + getLeb128UintLength(this.offset);
    }

    public dump(e: Emitter): void {
        this.value.dump(e);
        e.dump(`set_local $${this.offset}`, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
    }
}

export class WSetGlobal extends WStatement {
    public type: WType;
    public name: string;
    public value: WExpression;

    constructor(type: WType, name: string, value: WExpression, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.name = name;
        this.value = value;
    }

    public emit(e: Emitter): void {
        if (e.getGlobalType(this.name) !== this.type) {
            throw new EmitError(`type mismatch at set_global`);
        }
        this.value.emit(e);
        e.writeByte(Control.set_global);
        e.writeUint32(e.getGlobalIdx(this.name));
    }

    public emitJSON(e: JSONEmitter): void {
        if (e.getGlobalType(this.name) !== this.type) {
            throw new EmitError(`type mismatch at set_global`);
        }
        this.value.emitJSON(e);
        e.emitIns([Control.set_global, e.getGlobalIdx(this.name), this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return this.value.length(e) + 1 + getLeb128UintLength(e.getGlobalType(this.name));
    }

    public dump(e: Emitter): void {
        this.value.dump(e);
        e.dump(`set_global ${this.name}`, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
    }
}

export class WDrop extends WStatement {
    public value: WExpression;

    constructor(value: WExpression, location?: SourceLocation) {
        super(location);
        this.value = value;
    }

    public emit(e: Emitter): void {
        this.value.emit(e);
        e.writeByte(Control.drop);
    }

    public emitJSON(e: JSONEmitter): void {
        this.value.emitJSON(e);
        e.emitIns([Control.drop, 0, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return this.value.length(e) + 1;
    }

    public dump(e: Emitter): void {
        this.value.dump(e);
        e.dump(`drop`, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
    }

}

export class WBr extends WStatement {
    public labelIdx: number;

    constructor(labelIdx: number, location?: SourceLocation) {
        super(location);
        this.labelIdx = labelIdx;
    }

    public emit(e: Emitter): void {
        e.writeByte(Control.br);
        e.writeUint32(this.labelIdx);
    }

    public emitJSON(e: JSONEmitter): void {
        e.emitIns([Control.br, this.labelIdx, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return 1 + getLeb128UintLength(this.labelIdx);
    }

    public dump(e: Emitter): void {
        e.dump(`br ${this.labelIdx}`, this.location);
    }
}

export class WBrIf extends WStatement {
    public labelIdx: number;
    public expression: WExpression;

    constructor(labelIdx: number, expression: WExpression, location?: SourceLocation) {
        super(location);
        this.labelIdx = labelIdx;
        this.expression = expression;
    }

    public emit(e: Emitter): void {
        this.expression.emit(e);
        e.writeByte(Control.br_if);
        e.writeUint32(this.labelIdx);
    }

    public emitJSON(e: JSONEmitter): void {
        this.expression.emitJSON(e);
        e.emitIns([Control.br_if, this.labelIdx, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return this.expression.length(e) + 1 + getLeb128UintLength(this.labelIdx);
    }

    public dump(e: Emitter): void {
        this.expression.dump(e);
        e.dump(`br_if ${this.labelIdx}`, this.location);
    }

    public optimize(e: Emitter): void {
        this.expression = this.expression.fold();
        this.expression.optimize(e);
    }
}

export class WIfElseBlock extends WStatement {
    public condition: WExpression;
    public consequence: WStatement[];
    public alternative: WStatement[] | null;

    constructor(condition: WExpression, consequence: WStatement[],
                alternative: WStatement[] | null, location: SourceLocation) {
        super(location);
        this.condition = condition;
        this.consequence = consequence;
        this.alternative = alternative;
    }

    public emit(e: Emitter): void {
        this.condition.emit(e);
        e.writeByte(Control.if);
        e.writeByte(0x40);
        this.consequence.map((stmt) => stmt.emit(e));
        if (this.alternative !== null) {
            e.writeByte(Control.else);
            this.alternative.map((stmt) => stmt.emit(e));
        }
        e.writeByte(Control.end);
    }

    public emitJSON(e: JSONEmitter): void {
        this.condition.emitJSON(e);
        e.emitIns([Control.if, 0, this.getStartLine()]);
        this.consequence.map((stmt) => stmt.emitJSON(e));
        if (this.alternative !== null) {
            e.emitIns([Control.else, 0, this.getStartLine()]);
            this.alternative.map((stmt) => stmt.emitJSON(e));
        }
        e.emitIns([Control.end, 0, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        let baseLen = 3 + this.condition.length(e)
            + getArrayLength(this.consequence, (stmt) => stmt.length(e));
        if (this.alternative !== null) {
            baseLen += 1 + getArrayLength(this.alternative, (stmt) => stmt.length(e));
        }
        return baseLen;
    }

    public dump(e: Emitter): void {
        e.dump(`if(`, this.location);
        this.condition.emit(e);
        e.dump(`){`, this.location);
        e.changeDumpIndent(+1);
        this.consequence.map((x) => x.dump(e));
        e.changeDumpIndent(-1);
        if (this.alternative !== null) {
            e.dump(`}else{`);
            e.changeDumpIndent(+1);
            this.alternative.map((x) => x.dump(e));
            e.changeDumpIndent(-1);
        }
        e.dump(`}`);
    }

    public optimize(e: Emitter): void {
        this.condition = this.condition.fold();
        this.condition.optimize(e);
        this.consequence.map((x) => x.optimize(e));
        if (this.alternative !== null) {
            this.alternative.map((x) => x.optimize(e));
        }
    }
}

export class WBlock extends WStatement {
    public body: WStatement[];

    constructor(body: WStatement[], location?: SourceLocation) {
        super(location);
        this.body = body;
    }

    public emit(e: Emitter): void {
        e.writeByte(Control.block);
        e.writeByte(0x40);
        this.body.map((stmt) => stmt.emit(e));
        e.writeByte(Control.end);
    }

    public emitJSON(e: JSONEmitter): void {
        e.emitIns([Control.block, 0, this.getStartLine()]);
        this.body.map((stmt) => stmt.emitJSON(e));
        e.emitIns([Control.end, 0, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return getArrayLength(this.body, (stmt) => stmt.length(e)) + 3;
    }

    public dump(e: Emitter): void {
        e.dump(`block{`, this.location);
        e.changeDumpIndent(+1);
        this.body.map((x) => x.dump(e));
        e.changeDumpIndent(-1);
        e.dump(`}`);
    }

    public optimize(e: Emitter): void {
        this.body.map((x) => x.optimize(e));
    }
}

export class WLoop extends WStatement {
    public body: WStatement[];

    constructor(body: WStatement[], location?: SourceLocation) {
        super(location);
        this.body = body;
    }

    public emit(e: Emitter): void {
        e.writeByte(Control.loop);
        e.writeByte(0x40);
        this.body.map((stmt) => stmt.emit(e));
        e.writeByte(Control.end);
    }

    public emitJSON(e: JSONEmitter): void {
        e.emitIns([Control.loop, 0, this.getStartLine()]);
        this.body.map((stmt) => stmt.emitJSON(e));
        e.emitIns([Control.end, 0, this.getStartLine()]);
    }

    public length(e: Emitter): number {
        return getArrayLength(this.body, (stmt) => stmt.length(e)) + 3;
    }

    public dump(e: Emitter): void {
        e.dump(`loop{`, this.location);
        e.changeDumpIndent(+1);
        this.body.map((x) => x.dump(e));
        e.changeDumpIndent(-1);
        e.dump(`}`);
    }

    public optimize(e: Emitter): void {
        this.body.map((x) => x.optimize(e));
    }

}

export class WExprStatement extends WStatement {
    public expr: WExpression;

    constructor(expr: WExpression, location?: SourceLocation) {
        super(location);
        this.expr = expr;
    }

    public emit(e: Emitter): void {
        this.expr.emit(e);
    }

    public emitJSON(e: JSONEmitter): void {
        this.expr.emitJSON(e);
    }

    public length(e: Emitter): number {
        return this.expr.length(e);
    }

    public dump(e: Emitter): void {
        this.expr.dump(e);
    }

    public optimize(e: Emitter): void {
        this.expr = this.expr.fold();
        this.expr.optimize(e);
    }

}
