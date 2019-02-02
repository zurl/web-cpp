import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {JSONEmitter} from "../emitter/json_emitter";
import {WBinaryOperation} from "../expression/wbinary_operation";
import {WConst} from "../expression/wconst";
import {WExpression, WMemoryLocation} from "../expression/wexpression";
import {F32, F64, getNativeType, I32, I32Binary, I64, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WStore extends WStatement {
    public type: WType;
    public address: WExpression;
    public value: WExpression;
    public offset: number;
    public form: WMemoryLocation;
    public offsetName: string;

    constructor(type: WType,
                address: WExpression, value: WExpression,
                form: WMemoryLocation = WMemoryLocation.RAW, location: SourceLocation) {
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
        e.emitIns(this.getOp() as number, WType.u32, offset, this.location, true);
        if (e instanceof JSONEmitter) {
            e.memoryInfo.push([e.insBuffer.length, this.form, this.offset]);
        }
    }

    public replaceAddress() {
        this.address = new WBinaryOperation(I32Binary.add,
            this.address,
            new WConst(WType.i32, this.offset.toString(), this.location),
            this.location);
        this.offset = 0;
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
            offset += e.ctx.getCurrentFunc().dataStart;
        } else if ( this.form === WMemoryLocation.BSS ) {
            offset += e.ctx.getCurrentFunc().bssStart;
        } else if ( this.form === WMemoryLocation.EXTERN ) {
            offset += e.ctx.getExternLocation(this.offsetName);
        }
        if ( offset < 0 ) {
            this.replaceAddress();
            offset = 0;
        }
        return offset;
    }

}
