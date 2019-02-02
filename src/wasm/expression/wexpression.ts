import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {WType} from "../tool/constant";

export abstract class WExpression extends WNode {

    public abstract deduceType(e: Emitter): WType;

    public abstract isPure(): boolean;

    public fold(): WExpression {
        return this;
    }

}

export enum WMemoryLocation {
    RAW,
    DATA,
    BSS,
    EXTERN,
}
