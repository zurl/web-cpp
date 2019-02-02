import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {Control, getNativeType, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WReturn extends WStatement {
    public expr: WExpression | null;

    constructor(expr: WExpression | null, location: SourceLocation) {
        super(location);
        this.expr = expr;
        if (expr !== null) {
            this.expr = expr;
        }
    }

    public emit(e: Emitter): void {
        const curFunc = e.ctx.getCurrentFunc();
        if ( curFunc.type.returnTypes.length === 0 && this.expr !== null) {
            throw new EmitError(`type mismatch at WReturn`);
        }
        if ( curFunc.type.returnTypes.length !== 0) {
            if (this.expr === null) {
                throw new EmitError(`type mismatch at WReturn`);
            }
            const exprType = this.expr.deduceType(e);
            if (getNativeType(exprType) !== getNativeType(curFunc.type.returnTypes[0])) {
                throw new EmitError(`type mismatch at WReturn`);
            }
        }
        if (this.expr !== null) {
            this.expr.emit(e);
        }
        e.emitIns(Control.return, WType.none, 0, this.location);
    }

    public optimize(e: Emitter): void {
        if (this.expr !== null) {
            this.expr = this.expr.fold();
            this.expr.optimize(e);
        }
    }

}
