import {EmitError} from "../../common/error";
import {EmptyLocation, SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WType} from "../tool/constant";
import {WExpression} from "./wexpression";

export class WEmptyExpression extends WExpression {

    public static instance: WEmptyExpression;

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
        return true;
    }

}

WEmptyExpression.instance = new WEmptyExpression(EmptyLocation);
