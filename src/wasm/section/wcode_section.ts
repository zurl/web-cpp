import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WFunction} from "./wfunction";
import {WSection} from "./wsection";

export class WCodeSection extends WSection {
    public functions: WFunction[];

    constructor(functions: WFunction[], location: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.code);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.functions.length);
        this.functions.map((func) => func.emit(e));
        e.fillLengthSlot(slot);
    }

    public optimize(e: Emitter): void {
        this.functions.map((x) => x.optimize(e));
    }

}
