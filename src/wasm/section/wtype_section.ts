import {JSONEmitter} from "..";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WFunctionType} from "./wfunction_type";
import {WSection} from "./wsection";

export class WTypeSection extends WSection {
    public types: WFunctionType[];

    constructor(types: WFunctionType[], location: SourceLocation) {
        super(location);
        this.types = types;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.type);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.types.length);
        for (let i = 0; i < this.types.length; i++) {
            e.ctx.setTypeIdxFromEncoding(this.types[i].toEncoding(), i);
            this.types[i].emit(e);
        }
        e.fillLengthSlot(slot);
        if (e instanceof JSONEmitter) {
            e.getJSON().types = this.types.map( (x) => x.toEncoding());
        }
    }
}
