import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {Control, getNativeType, WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WConditionalExpression extends WExpression {
    public condition: WExpression;
    public consequence: WExpression;
    public alternative: WExpression;

    constructor(condition: WExpression, consequence: WExpression,
                alternative: WExpression, location: SourceLocation) {
        super(location);
        this.condition = condition;
        this.consequence = consequence;
        this.alternative = alternative;
    }

    public deduceType(e: Emitter): WType {
        const l = this.consequence.deduceType(e);
        const r = this.alternative.deduceType(e);
        if (getNativeType(l) === getNativeType(r)) {
            return getNativeType(l);
        } else {
            throw new EmitError(`type mismatch at contional expression`);
        }
    }
    public isPure(): boolean {
        return this.condition.isPure() && this.alternative.isPure() &&
            this.alternative.isPure();
    }

    public emit(e: Emitter): void {
        this.condition.emit(e);
        e.emitIns(Control.if, WType.u8, this.deduceType(e), this.location);
        this.consequence.emit(e);
        e.emitIns(Control.else, WType.none, 0, this.location);
        this.alternative.emit(e);
        e.emitIns(Control.end, WType.none, 0,  this.location);

    }
    public optimize(e: Emitter): void {
        this.condition = this.condition.fold();
        this.condition.optimize(e);
        this.alternative = this.alternative.fold();
        this.alternative.optimize(e);
        this.consequence = this.consequence.fold();
        this.consequence.optimize(e);
    }
}
