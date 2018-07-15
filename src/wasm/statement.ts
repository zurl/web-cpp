/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {EmitError} from "../common/error";
import {Control, WType, WTypeMap} from "./constant";
import {Emitter} from "./emitter";
import {getAlign} from "./expression";
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

    constructor(type: WType,
                address: WExpression, value: WExpression, location?: SourceLocation) {
        super(location);
        this.type = type;
        this.address = address;
        this.value = value;
        this.offset = 0;
    }

    public emit(e: Emitter): void {
        if ( this.value.deduceType(e) !== this.type) {
            throw new EmitError(`type mismatch at store`);
        }
        if ( this.address.deduceType(e) !== WType.u32 && this.address.deduceType(e) !== WType.i32 ) {
            throw new EmitError(`type mismatch at store`);
        }
        this.address.emit(e);
        this.value.emit(e);
        e.writeByte((WTypeMap.get(this.type) as any)["store"]);
        e.writeUint32(getAlign(this.offset));
        e.writeUint32(this.offset);
    }

    public length(e: Emitter): number {
        return this.address.length(e) + this.value.length(e) +
            getLeb128UintLength(getAlign(this.offset)) +
            getLeb128UintLength(this.offset) + 1;
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

export class WBr extends WStatement{
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

export class WBrIf extends WStatement{
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
        this.body.map((stmt) => stmt.emit(e));
        e.writeByte(Control.end);
    }

    public length(e: Emitter): number {
        return getArrayLength(this.body, (stmt) => stmt.length(e)) + 2;
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
        this.body.map((stmt) => stmt.emit(e));
        e.writeByte(Control.end);
    }

    public length(e: Emitter): number {
        return getArrayLength(this.body, (stmt) => stmt.length(e)) + 2;
    }

}
