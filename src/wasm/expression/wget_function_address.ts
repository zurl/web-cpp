import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {I32, WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WGetFunctionAddress extends WExpression {
    public name: string;

    constructor(name: string, location: SourceLocation) {
        super(location);
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.emitIns(I32.const, WType.u32, e.ctx.getFuncInfo(this.name).id, this.location);
    }

    public deduceType(e: Emitter): WType {
        return WType.i32;
    }

    public isPure(): boolean {
        return true;
    }
}
