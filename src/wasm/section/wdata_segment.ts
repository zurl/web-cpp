import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WConst} from "../expression/wconst";
import {WExpression} from "../expression/wexpression";
import {WNode} from "../node";
import {Control, WType} from "../tool/constant";

export class WDataSegment extends WNode {
    public memIdx: number;
    public offset: WExpression;
    public dataBuffer: ArrayBuffer;
    public offsetNumber: number;

    constructor(offset: number, dataBuffer: ArrayBuffer, location: SourceLocation) {
        super(location);
        this.memIdx = 0;
        this.offsetNumber = offset;
        this.offset = new WConst(WType.i32, offset.toString(), location);
        this.dataBuffer = dataBuffer;
    }

    public emit(e: Emitter): void {
        e.emit(WType.u32, this.memIdx);
        this.offset.emit(e);
        e.writeByte(Control.end);
        e.emit(WType.u32, this.dataBuffer.byteLength);
        const ui8a = new Uint8Array(this.dataBuffer);
        for (let i = 0; i < this.dataBuffer.byteLength; i++) {
            e.writeByte(ui8a[i]);
        }
    }

}
