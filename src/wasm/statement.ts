/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {EmitError} from "../common/error";
import {Control, F32, F64, I32, I32Binary, I64, WType, WTypeMap} from "./constant";
import {Emitter} from "./emitter";
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
            if (exprType !== curFunc.type.returnTypes[0]) {
                throw new EmitError(`type mismatch at WReturn`);
            }
        }
        if (this.expr !== null) {
            this.expr.emit(e);
        }
        e.writeByte(Control.return);
    }

    public length(e: Emitter): number {
        if (this.expr !== null) {
            return this.expr.length(e) + 1;
        }
        return 1;
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

    public emit(e: Emitter): void {
        if ( this.value.deduceType(e) !== this.type) {
            throw new EmitError(`type mismatch at store`);
        }
        if ( this.address.deduceType(e) !== WType.u32 && this.address.deduceType(e) !== WType.i32 ) {
            throw new EmitError(`type mismatch at store`);
        }
        let offset = this.offset;
        if ( this.form === WMemoryLocation.DATA ) {
            offset += e.getCurrentFunc().dataStart;
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            offset += e.getExternLocation(this.offsetName);
        }

        if ( offset < 0 ) {
            this.replaceAddress();
            offset = 0;
        }
        this.address.emit(e);
        this.value.emit(e);
        switch (this.type) {
            case WType.u8:
            case WType.i8: e.writeByte(I32.store8); break;
            case WType.i16:
            case WType.u16: e.writeByte(I32.store16); break;
            case WType.i32:
            case WType.u32: e.writeByte(I32.store); break;
            case WType.f32: e.writeByte(F32.store); break;
            case WType.f64: e.writeByte(F64.store); break;
            case WType.i64:
            case WType.u64: e.writeByte(I64.store); break;
        }
        e.writeUint32(getAlign(offset));
        e.writeUint32(offset);
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

    public length(e: Emitter): number {
        return this.value.length(e) + 1 + getLeb128UintLength(this.offset);
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

    public length(e: Emitter): number {
        return this.value.length(e) + 1 + getLeb128UintLength(e.getGlobalType(this.name));
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

    public length(e: Emitter): number {
        return this.value.length(e) + 1;
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

    public length(e: Emitter): number {
        return 1 + getLeb128UintLength(this.labelIdx);
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

    public length(e: Emitter): number {
        return this.expression.length(e) + 1 + getLeb128UintLength(this.labelIdx);
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
            this.consequence.map((stmt) => stmt.emit(e));
        }
        e.writeByte(Control.end);
    }

    public length(e: Emitter): number {
        let baseLen = 3 + this.condition.length(e)
            + getArrayLength(this.consequence, (stmt) => stmt.length(e));
        if (this.alternative !== null) {
            baseLen += 1 + getArrayLength(this.alternative, (stmt) => stmt.length(e));
        }
        return baseLen;
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

    public length(e: Emitter): number {
        return getArrayLength(this.body, (stmt) => stmt.length(e)) + 3;
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

    public length(e: Emitter): number {
        return getArrayLength(this.body, (stmt) => stmt.length(e)) + 3;
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

    public length(e: Emitter): number {
        return this.expr.length(e);
    }

}
