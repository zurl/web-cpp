import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {Statement} from "./statement";

export class GotoStatement extends Statement {
    public label: Identifier;

    constructor(location: SourceLocation, label: Identifier) {
        super(location);
        this.label = label;
    }

    public codegen(ctx: CompileContext): void {
        throw new SyntaxError("goto statement is not support currently", this);

    }
}
