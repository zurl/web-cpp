import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WSetGlobal extends WStatement {
    public type: WType;
    public name: string;
    public value: WExpression;

    constructor(type: WType, name: string, value: WExpression, location: SourceLocation) {
        super(location);
        this.type = type;
        this.name = name;
        this.value = value;
    }

    public emit(e: Emitter): void {
        if (e.ctx.getGlobalInfo(this.name).type !== this.type) {
            throw new EmitError(`type mismatch at set_global`);
        }
        this.value.emit(e);
        e.emitIns(Control.set_global, WType.u32, e.ctx.getGlobalInfo(this.name).id, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
    }
}
