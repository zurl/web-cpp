import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WExportFunction} from "./wexport_function";
import {WSection} from "./wsection";

export class WExportSection extends WSection {
    public functions: WExportFunction[];

    constructor(functions: WExportFunction[], location: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.export);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.functions.length);
        this.functions.map((func) => func.emit(e));
        e.fillLengthSlot(slot);
    }
}
