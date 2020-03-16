import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WBr extends WStatement {
    public labelIdx: number;

    constructor(labelIdx: number, location: SourceLocation) {
        super(location);
        this.labelIdx = labelIdx;
    }

    public emit(e: Emitter): void {
        e.emitIns(Control.br, WType.u32, this.labelIdx, this.location);
    }
}
