import {Directive, SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {SingleIdentifier} from "../expression/identifier";

export class NameSpaceBlock extends Directive {
    public namespace: SingleIdentifier;
    public statements: Directive[];

    constructor(location: SourceLocation, namespace: SingleIdentifier, statements: Directive[]) {
        super(location);
        this.namespace = namespace;
        this.statements = statements;
    }

    public codegen(ctx: CompileContext): void {
        ctx.scopeManager.enterScope(this.namespace.name);
        this.statements.map((x) => x.codegen(ctx));
        ctx.exitScope(this);
    }

}
