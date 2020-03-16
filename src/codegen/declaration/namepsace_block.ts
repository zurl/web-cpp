import {Directive, SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {Scope} from "../scope";

export class NameSpaceBlock extends Directive {
    public namespace: Identifier;
    public statements: Directive[];

    constructor(location: SourceLocation, namespace: Identifier, statements: Directive[]) {
        super(location);
        this.namespace = namespace;
        this.statements = statements;
    }

    public codegen(ctx: CompileContext): void {
        // TODO::
        const newScope = new Scope(this.namespace.getPlainName(ctx),
            ctx.scopeManager.currentContext.scope, ctx.isCpp());
        ctx.scopeManager.currentContext.scope.children.push(newScope);
        ctx.scopeManager.contextStack.push(ctx.scopeManager.currentContext);
        ctx.scopeManager.currentContext = {
            scope: newScope,
            activeScopes: [...ctx.scopeManager.currentContext.activeScopes, newScope],
        };
        this.statements.map((x) => x.codegen(ctx));
        ctx.exitScope(this);
    }

}
