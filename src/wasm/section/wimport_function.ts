import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {JSONEmitter} from "../emitter/json_emitter";
import {WType} from "../tool/constant";
import {WFunctionType} from "./wfunction_type";
import {WImportItem} from "./wimport_item";

export class WImportFunction extends WImportItem {

    public type: WFunctionType;
    public signatureId: number;

    constructor(module: string, name: string, returnType: WType[],
                parameters: WType[], location: SourceLocation) {
        super(module, name, location);
        this.module = module;
        this.name = name;
        this.type = new WFunctionType(returnType, parameters, this.location);
        this.signatureId = 0;
    }

    public emit(e: Emitter): void {
        super.emit(e);
        e.writeByte(0x00);
        e.emit(WType.u32, this.signatureId);
        e.ctx.submitFunc(this.name, this.type);
        if (e instanceof JSONEmitter) {
            e.getJSON().imports.push({
                module: this.module,
                name: this.name,
                type: this.type.toEncoding(),
            });
        }
    }
}
