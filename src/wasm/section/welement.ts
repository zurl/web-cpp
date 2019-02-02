import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WConst} from "../expression/wconst";
import {WExpression} from "../expression/wexpression";
import {WNode} from "../node";
import {Control, WType} from "../tool/constant";

export class WElement extends WNode {

    public len: number;
    public offset: WExpression;

    constructor(idx: number, location: SourceLocation) {
        super(location);
        this.len = idx;
        this.offset = new WConst(WType.i32, "0", location);
    }

    public emit(e: Emitter): void {
        e.writeByte(0x00); // table idx
        this.offset.emit(e);
        e.writeByte(Control.end);
        e.emit(WType.u32, this.len);
        for (let i = 0; i < this.len; i++) {
            e.emit(WType.u32, i);
        }
    }
}
