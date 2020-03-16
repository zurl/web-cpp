import {Directive, SourceLocation} from "../../common/node";
import {triggerAllDestructor} from "../class/destructor";
import {CompileContext} from "../context";
import {Statement} from "./statement";

export class CompoundStatement extends Statement {
    public body: Directive[];

    constructor(location: SourceLocation, body: Directive[]) {
        super(location);
        this.body = body;
    }

    public codegen(ctx: CompileContext) {
        ctx.enterScope();
        this.body.map((x) => x.codegen(ctx));
        triggerAllDestructor(ctx, this);
        ctx.exitScope(this);
    }
}
