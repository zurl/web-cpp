import {Directive, SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";

export class NameSpaceBlock extends Directive {
    public namespace: Identifier;
    public statements: Directive[];

    constructor(location: SourceLocation, namespace: Identifier, statements: Directive[]) {
        super(location);
        this.namespace = namespace;
        this.statements = statements;
    }

    public codegen(ctx: CompileContext): void {
        ctx.scopeManager.enterScope(this.namespace.getFullName(ctx));
        this.statements.map((x) => x.codegen(ctx));
        ctx.exitScope(this);
    }

}
