import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {JSONEmitter} from "../emitter/json_emitter";
import {SectionCode, WType} from "../tool/constant";
import {WDataSegment} from "./wdata_segment";
import {WSection} from "./wsection";

export class WDataSection extends WSection {
    public segments: WDataSegment[];

    constructor(segments: WDataSegment[], location: SourceLocation) {
        super(location);
        this.segments = segments;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.data);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.segments.length);
        this.segments.map((x) => x.emit(e));
        e.fillLengthSlot(slot);
        if (e instanceof JSONEmitter) {
            e.getJSON().data = this.segments.map((x) => ({
                offset: x.offsetNumber,
                data: x.dataBuffer,
            }));
        }
    }
}
