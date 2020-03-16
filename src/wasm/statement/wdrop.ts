import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WExpression} from "../expression/wexpression";
import {Control, WType} from "../tool/constant";
import {WStatement} from "./wstatement";

export class WDrop extends WStatement {
    public value: WExpression;

    constructor(value: WExpression, location: SourceLocation) {
        super(location);
        this.value = value;
    }

    public emit(e: Emitter): void {
        this.value.emit(e);
        e.emitIns(Control.drop, WType.none, 0, this.location);
    }

    public optimize(e: Emitter): void {
        this.value = this.value.fold();
        this.value.optimize(e);
    }

}
