import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {Control, WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WGetLocal extends WExpression {
    public type: WType;
    public offset: number;

    constructor(type: WType, offset: number, location: SourceLocation) {
        super(location);
        this.type = type;
        this.offset = offset;
    }

    public emit(e: Emitter): void {
        e.emitIns(Control.get_local, WType.u32, this.offset, this.location);
    }

    public deduceType(e: Emitter): WType {
        return this.type;
    }
    public isPure(): boolean {
        return true;
    }

}
