import * as Long from "long";
import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {doBinaryCompute, doLongBinaryCompute} from "../tool/calculator";
import {BinaryOperator, getNativeType, OpTypeMap, WType} from "../tool/constant";
import {WConst} from "./wconst";
import {WExpression} from "./wexpression";

export class WBinaryOperation extends WExpression {
    public ope: BinaryOperator;
    public lhs: WExpression;
    public rhs: WExpression;

    constructor(ope: BinaryOperator, lhs: WExpression, rhs: WExpression, location: SourceLocation) {
        super(location);
        this.ope = ope;
        this.lhs = lhs;
        this.rhs = rhs;
    }

    public emit(e: Emitter): void {
        this.lhs.emit(e);
        this.rhs.emit(e);
        e.emitIns(this.ope, WType.none, 0, this.location);
    }

    public deduceType(e: Emitter): WType {
        const lhs = getNativeType(this.lhs.deduceType(e));
        const rhs = getNativeType(this.rhs.deduceType(e));
        if (lhs !== rhs || OpTypeMap.get(this.ope) !== lhs) {
            throw new EmitError(`type mismatch in binaryope`);
        }
        return lhs;
    }

    public fold(): WExpression {
        this.lhs = this.lhs.fold();
        this.rhs = this.rhs.fold();
        if (this.lhs instanceof WConst && this.rhs instanceof WConst) {
            const type = OpTypeMap.get(this.ope)!;
            if (type === WType.f32 || type === WType.f64) {
                return new WConst(type,
                    doBinaryCompute(this.ope,
                        parseFloat(this.lhs.constant),
                        parseFloat(this.rhs.constant)).toString(), this.location);
            } else if (type === WType.i32) {
                return new WConst(type,
                    doBinaryCompute(this.ope,
                        parseInt(this.lhs.constant),
                        parseInt(this.rhs.constant)).toString(), this.location);
            } else {
                return new WConst(type,
                    doLongBinaryCompute(this.ope,
                        Long.fromString(this.lhs.constant),
                        Long.fromString(this.rhs.constant)).toString(), this.location);
            }
        } else {
            return this;
        }
    }

    public isPure(): boolean {
        return this.lhs.isPure() && this.rhs.isPure();
    }
}
