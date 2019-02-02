import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WType} from "../tool/constant";
import {WImportItem} from "./wimport_item";

export class WImportMemory extends WImportItem {
    public min: number;
    public max: number | null;

    constructor(module: string, name: string, min: number, max: number | null, location: SourceLocation) {
        super(module, name, location);
        this.min = min;
        this.max = max;
    }

    public emit(e: Emitter): void {
        super.emit(e);
        e.writeByte(0x02);
        if (this.max === null) {
            e.writeByte(0x00);
            e.emit(WType.u32, this.min);
        } else {
            e.writeByte(0x01);
            e.writeByte(this.min);
            e.writeByte(this.max);
        }
    }
}
