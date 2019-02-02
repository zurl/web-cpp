import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WSetLocal extends WStatement {
    public type: WType;
    public offset: number;
    public value: WExpression;

    constructor(type: WType, offset: number, value: WExpression, location: SourceLocation) {
        super(location);
        this.type = type;
        this.offset = offset;
        this.value = value;
    }

    public emit(e: Emitter): void {
        this.value.emit(e);
        e.emitIns(Control.set_local, WType.u32, this.offset, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
    }
}
