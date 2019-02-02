import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WEmptyExpression extends WExpression {

    constructor(location: SourceLocation) {
        super(location);
    }

    public deduceType(e: Emitter): WType {
        throw new EmitError(`internal error`);
    }

    public emit(e: Emitter): void {
        throw new EmitError(`internal error`);
    }

    public isPure(): boolean {
        throw new EmitError(`internal error`);
    }

}
