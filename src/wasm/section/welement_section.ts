import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WElement} from "./welement";
import {WSection} from "./wsection";

export class WElementSection extends WSection {
    public elems: WElement[];

    constructor(len: number, location: SourceLocation) {
        super(location);
        this.elems = [new WElement(len, location)];
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.element);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.elems.length);
        this.elems.map((x) => x.emit(e));
        e.fillLengthSlot(slot);
    }

}
