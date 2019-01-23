import {SyntaxError} from "../../common/error";
import {ClassDirective, SourceLocation} from "../../common/node";
import {ClassType} from "../../type/class_type";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {Statement} from "./statement";

export class UsingNamespaceStatement extends ClassDirective {
    public namespace: Identifier;

    constructor(location: SourceLocation, namespace: Identifier) {
        super(location);
        this.namespace = namespace;
    }

    public codegen(ctx: CompileContext): void {
        const scope =
            ctx.scopeManager.root.getScopeOfLookupName(this.namespace.getLookupName(ctx) + "::a");
        if ( !scope) {
            throw new SyntaxError(`${this.namespace.getFullName(ctx)} is not a namespace`, this);
        }
        ctx.scopeManager.currentContext.activeScopes.push(scope);
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        this.codegen(ctx);
    }

}
