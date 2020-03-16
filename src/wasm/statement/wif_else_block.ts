import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WIfElseBlock extends WStatement {
    public condition: WExpression;
    public consequence: WStatement[];
    public alternative: WStatement[] | null;

    constructor(condition: WExpression, consequence: WStatement[],
                alternative: WStatement[] | null, location: SourceLocation) {
        super(location);
        this.condition = condition;
        this.consequence = consequence;
        this.alternative = alternative;
    }

    public emit(e: Emitter): void {
        this.condition.emit(e);
        e.emitIns(Control.if, WType.u8, 0x40, this.location);
        this.consequence.map((stmt) => stmt.emit(e));
        if (this.alternative !== null) {
            e.emitIns(Control.else, WType.none, 0, this.location);
            this.alternative.map((stmt) => stmt.emit(e));
        }
        e.emitIns(Control.end, WType.none, 0, this.location);
    }

    public optimize(e: Emitter): void {
        this.condition = this.condition.fold();
        this.condition.optimize(e);
        this.consequence.map((x) => x.optimize(e));
        if (this.alternative !== null) {
            this.alternative.map((x) => x.optimize(e));
        }
    }
}
