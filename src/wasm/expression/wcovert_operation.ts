import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {ConvertOperator, WType} from "../tool/constant";
import {WConst} from "./wconst";
import {WExpression} from "./wexpression";

export class WCovertOperation extends WExpression {
    public srcType: WType;
    public dstType: WType;
    public ope: ConvertOperator;
    public operand: WExpression;

    constructor(srcType: WType, dstType: WType, operand: WExpression, ope: ConvertOperator, location: SourceLocation) {
        super(location);
        this.srcType = srcType;
        this.dstType = dstType;
        this.operand = operand;
        this.ope = ope;
    }

    public emit(e: Emitter): void {
        this.operand.emit(e);
        e.emitIns(this.ope, WType.none, 0, this.location);
    }

    public deduceType(e: Emitter): WType {
        return this.dstType;
    }

    public fold(): WExpression {
        this.operand = this.operand.fold();
        if (this.operand instanceof WConst) {
            if ( this.dstType === WType.f32 || this.dstType === WType.f64) {
                this.operand.constant = parseFloat(this.operand.constant).toString();
            } else {
                this.operand.constant = parseInt(this.operand.constant).toString();
            }
            this.operand.type = this.dstType;
            return this.operand;
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.operand.isPure();
    }

}
