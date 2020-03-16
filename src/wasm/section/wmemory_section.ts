import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {SectionCode, WType} from "../tool/constant";

export class WMemorySection extends WNode {
    public pageInfo: Array<[number, number | null]>;

    constructor(pageInfo: Array<[number, (number | null)]>, location: SourceLocation) {
        super(location);
        this.pageInfo = pageInfo;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.memory);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.pageInfo.length);
        this.pageInfo.map((tuple) => {
            const val = tuple[1];
            if (val === null) {
                e.writeByte(0x00);
                e.emit(WType.u32, tuple[0]);
            } else {
                e.writeByte(0x01);
                e.emit(WType.u32, tuple[0]);
                e.emit(WType.u32, val);
            }
        });
        e.fillLengthSlot(slot);
    }
}
