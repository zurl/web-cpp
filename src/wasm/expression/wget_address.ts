import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {JSONEmitter} from "../emitter/json_emitter";
import {I32, WType} from "../tool/constant";
import {WExpression, WMemoryLocation} from "./wexpression";

export class WGetAddress extends WExpression {
    public form: WMemoryLocation;
    public offset: number;
    public offsetName: string;

    constructor(form: WMemoryLocation, location: SourceLocation) {
        super(location);
        this.form = form;
        this.offset = 0;
        this.offsetName = "";
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
        e.emitIns(I32.const, WType.u32, offset, this.location);
        if (e instanceof JSONEmitter) {
            e.memoryInfo.push([e.insBuffer.length, this.form, this.offset]);
        }
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
}
