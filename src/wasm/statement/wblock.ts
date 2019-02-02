import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WBlock extends WStatement {
    public body: WStatement[];

    constructor(body: WStatement[], location: SourceLocation) {
        super(location);
        this.body = body;
    }

    public emit(e: Emitter): void {
        e.emitIns(Control.block, WType.u8, 0x40, this.location);
        this.body.map((stmt) => stmt.emit(e));
        e.emitIns(Control.end, WType.none, 0, this.location);
    }
    public optimize(e: Emitter): void {
        this.body.map((x) => x.optimize(e));
    }
}
