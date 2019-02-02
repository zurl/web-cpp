import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {F32, F64, I32, I32Binary, I64, WType} from "../tool/constant";
import {WBinaryOperation} from "./wbinary_operation";
import {WConst} from "./wconst";
import {WExpression, WMemoryLocation} from "./wexpression";
import {JSONEmitter} from "../emitter/json_emitter";

export class WLoad extends WExpression {
    public type: WType;
    public address: WExpression;
    public offset: number;
    public offsetName: string;
    public form: WMemoryLocation;

    constructor(type: WType, address: WExpression,
                form: WMemoryLocation = WMemoryLocation.RAW, location: SourceLocation) {
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
        this.address.emit(e);
        e.emitIns(this.getOp() as number, WType.u32, offset, this.location, true);
        if(e instanceof JSONEmitter){
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
