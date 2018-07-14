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
import {WExpression, WStatement} from "./node";

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
