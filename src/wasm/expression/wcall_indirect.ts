import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WFunctionType} from "../section/wfunction_type";
import {WStatement} from "../statement/wstatement";
import {Control, WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WCallIndirect extends WExpression {
    public target: WExpression;
    public argument: WExpression[];
    public afterStatements: WStatement[];
    public typeEncoding: string;

    constructor(target: WExpression, typeEncoding: string, argument: WExpression[],
                afterStatements: WStatement[], location: SourceLocation) {
        super(location);
        this.target = target;
        this.typeEncoding = typeEncoding;
        this.argument = argument;
        this.afterStatements = afterStatements;
    }

    public emit(e: Emitter): void {
        this.argument.map((x) => x.emit(e));
        this.target.emit(e);
        e.emitIns(Control.call_indirect, WType.u8, e.ctx.getTypeIdxFromEncoding(this.typeEncoding),
            this.location);
        e.writeByte(0x00);
        this.afterStatements.map((x) => x.emit(e));
    }
    public deduceType(e: Emitter): WType {
        if (this.typeEncoding.charAt(0) === "v") {
            return WType.none;
        } else {
            return WFunctionType.s2n(this.typeEncoding.charAt(0));
        }
    }

    public fold(): WExpression {
        this.argument = this.argument.map((x) => x.fold());
        return this;
    }

    public isPure(): boolean {
        return false;
    }

}
