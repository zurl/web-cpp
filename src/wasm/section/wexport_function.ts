import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {JSONEmitter} from "../emitter/json_emitter";
import {WNode} from "../node";
import {WType} from "../tool/constant";

export class WExportFunction extends WNode {
    public name: string;

    constructor(name: string, location: SourceLocation) {
        super(location);
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.emit(WType.str, this.name);
        e.writeByte(0x00);
        e.emit(WType.u32, e.ctx.getFuncInfo(this.name).id);
        if (e instanceof JSONEmitter) {
            e.getJSON().exports[this.name] = e.ctx.getFuncInfo(this.name).id;
        }
    }

}
