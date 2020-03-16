import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {WStatement} from "./wstatement";

export class WExprStatement extends WStatement {
    public expr: WExpression;

    constructor(expr: WExpression, location: SourceLocation) {
        super(location);
        this.expr = expr;
    }

    public emit(e: Emitter): void {
        this.expr.emit(e);
    }

    public optimize(e: Emitter): void {
        this.expr = this.expr.fold();
        this.expr.optimize(e);
    }

}
