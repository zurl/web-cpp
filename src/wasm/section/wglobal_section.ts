import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {SectionCode, WType} from "../tool/constant";
import {WGlobalVariable} from "./wglobal_variable";
import {WSection} from "./wsection";

export class WGlobalSection extends WSection {
    public globals: WGlobalVariable[];

    constructor(functions: WGlobalVariable[], location: SourceLocation) {
        super(location);
        this.globals = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.global);
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.globals.length);
        this.globals.map((x) => x.emit(e));
        e.fillLengthSlot(slot);
    }
}
