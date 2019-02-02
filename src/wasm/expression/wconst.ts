import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {F32, F64, getNativeType, I32, I64, WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WConst extends WExpression {
    public type: WType;
    public constant: string;

    constructor(type: WType, constant: string, location: SourceLocation) {
        super(location);
        this.type = type;
        this.constant = constant;
    }

    public emit(e: Emitter): void {
        switch (getNativeType(this.type)) {
            case WType.i32:
                e.emitIns(I32.const, WType.i32, parseInt(this.constant), this.location);
                break;
            case WType.i64:
                e.emitIns(I64.const, WType.i64, this.constant.split(".")[0], this.location);
                break;
            case WType.f32:
                e.emitIns(F32.const, WType.f32, parseFloat(this.constant), this.location);
                break;
            case WType.f64:
                e.emitIns(F64.const, WType.f64, parseFloat(this.constant), this.location);
                break;
        }
    }

    public deduceType(e: Emitter): WType {
        return this.type;
    }

    public isPure(): boolean {
        return true;
    }
}
