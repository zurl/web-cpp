import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {WType} from "../tool/constant";

export class WTable extends WNode {

    public len: number;

    constructor(len: number, location: SourceLocation) {
        super(location);
        this.len = len;
    }

    public emit(e: Emitter): void {
        e.writeByte(0x70);
        e.writeByte(0x00);
        e.emit(WType.u32, this.len);
    }

}
