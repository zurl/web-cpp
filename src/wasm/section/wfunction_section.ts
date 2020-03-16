import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WFunction} from "./wfunction";
import {WSection} from "./wsection";

export class WFunctionSection extends WSection {
    public functions: WFunction[];

    constructor(functions: WFunction[], location: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.function);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.functions.length);
        this.functions.map((x) => e.ctx.submitFunc(x.name, x.type));
        this.functions.map((x) => e.emit(WType.u32, x.signatureId));
        e.fillLengthSlot(slot);
    }
}
