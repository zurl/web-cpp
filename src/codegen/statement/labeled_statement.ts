import {SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {Statement} from "./statement";

export class LabeledStatement extends Statement {
    public label: Identifier;
    public body: Statement;

    constructor(location: SourceLocation, label: Identifier, body: Statement) {
        super(location);
        this.label = label;
        this.body = body;
    }

    public codegen(ctx: CompileContext): void {
        this.body.codegen(ctx);
    }
}
