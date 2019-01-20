import {Directive, SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Statement} from "./statement";
import {triggerAllDestructor} from "../class/destructor";

export class CompoundStatement extends Statement {
    public body: Directive[];

    constructor(location: SourceLocation, body: Directive[]) {
        super(location);
        this.body = body;
    }

    public codegen(ctx: CompileContext) {
        ctx.enterScope();
        triggerAllDestructor(ctx, this);
        ctx.exitScope(this);
    }
}
