import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WSection} from "./wsection";
import {WTable} from "./wtable";

export class WTableSection extends WSection {

    public tables: WTable[];

    constructor(tables: WTable[], location: SourceLocation) {
        super(location);
        this.tables = tables;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.table);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.tables.length);
        this.tables.map((x) => x.emit(e));
        e.fillLengthSlot(slot);
    }
}
