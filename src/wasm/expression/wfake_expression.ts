import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WStatement} from "../statement/wstatement";
import {WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WFakeExpression extends WExpression {
    public statement: WStatement;

    constructor(statement: WStatement, location: SourceLocation) {
        super(location);
        this.statement = statement;
    }

    public deduceType(e: Emitter): WType {
        throw new EmitError(`internal error`);
    }

    public emit(e: Emitter): void {
        this.statement.emit(e);
    }

    public isPure(): boolean {
        return false;
    }
}
