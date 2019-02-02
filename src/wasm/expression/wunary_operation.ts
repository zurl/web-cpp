import * as Long from "long";
import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {doLongUnaryCompute, doUnaryCompute} from "../tool/calculator";
import {getNativeType, OpTypeMap, UnaryOperator, WType} from "../tool/constant";
import {WConst} from "./wconst";
import {WExpression} from "./wexpression";

export class WUnaryOperation extends WExpression {
    public ope: UnaryOperator;
    public operand: WExpression;

    constructor(ope: UnaryOperator, operand: WExpression, location: SourceLocation) {
        super(location);
        this.ope = ope;
        this.operand = operand;
    }

    public emit(e: Emitter): void {
        this.operand.emit(e);
        e.emitIns(this.ope, WType.none, 0, this.location);
    }

    public deduceType(e: Emitter): WType {
        if ( getNativeType(this.operand.deduceType(e)) !== OpTypeMap.get(this.ope)) {
            throw new EmitError(`type mismatch at unary ope`);
        }
        return this.operand.deduceType(e);
    }

    public fold(): WExpression {
        this.operand = this.operand.fold();
        if (this.operand instanceof WConst) {
            const type = OpTypeMap.get(this.ope)!;
            if (type === WType.f32 || type === WType.f64) {
                return new WConst(type,
                    doUnaryCompute(this.ope,
                        parseFloat(this.operand.constant)).toString(), this.location);
            } else if (type === WType.i32) {
                return new WConst(type,
                    doUnaryCompute(this.ope,
                        parseInt(this.operand.constant)).toString(), this.location);
            } else {
                return new WConst(type,
                    doLongUnaryCompute(this.ope,
                        Long.fromString(this.operand.constant)).toString(), this.location);
            }
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.operand.isPure();
    }
}
