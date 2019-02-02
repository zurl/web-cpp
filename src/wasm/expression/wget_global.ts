import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {Control, WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WGetGlobal extends WExpression {
    public type: WType;
    public name: string;

    constructor(type: WType, name: string, location: SourceLocation) {
        super(location);
        this.type = type;
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.emitIns(Control.get_global, WType.u32, e.ctx.getGlobalInfo(this.name).id, this.location);
    }

    public deduceType(e: Emitter): WType {
        if ( this.type !== e.ctx.getGlobalInfo(this.name).type) {
            throw new EmitError(`type mismatch at getglobal`);
        }
        return this.type;
    }

    public isPure(): boolean {
        return true;
    }
}
