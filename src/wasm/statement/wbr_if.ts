import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WBrIf extends WStatement {
    public labelIdx: number;
    public expression: WExpression;

    constructor(labelIdx: number, expression: WExpression, location: SourceLocation) {
        super(location);
        this.labelIdx = labelIdx;
        this.expression = expression;
    }

    public emit(e: Emitter): void {
        this.expression.emit(e);
        e.emitIns(Control.br_if, WType.u32, this.labelIdx, this.location);
    }

    public optimize(e: Emitter): void {
        this.expression = this.expression.fold();
        this.expression.optimize(e);
    }
}
