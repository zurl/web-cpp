import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {SectionCode, WType} from "../tool/constant";
import {WImportItem} from "./wimport_item";

export class WImportSection extends WNode {
    public imports: WImportItem[];

    constructor(imports: WImportItem[],
                location: SourceLocation) {
        super(location);
        this.imports = imports;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.import);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.imports.length);
        this.imports.map((x) => x.emit(e));
        e.fillLengthSlot(slot);
    }
}
