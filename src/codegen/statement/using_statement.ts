import {SyntaxError} from "../../common/error";
import {ClassDirective, SourceLocation} from "../../common/node";
import {ClassType} from "../../type/class_type";
import {TypeName} from "../class/type_name";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {FunctionLookUpResult} from "../scope";

export class UsingStatement extends ClassDirective {
    public name: Identifier;
    public type: TypeName | null;

    constructor(location: SourceLocation, name: Identifier, type: TypeName | null) {
        super(location);
        this.name = name;
        this.type = type;
    }

    public codegen(ctx: CompileContext): void {
        if (this.type) {
            const type = this.type.deduceType(ctx);
            ctx.scopeManager.define(this.name.getPlainName(ctx), type, this);
        } else {
            const item = ctx.scopeManager.lookup(this.name.getLookupName(ctx));
            if ( item === null ) {
                throw new SyntaxError(`undefine symbol ${this.name.name}`, this);
            }
            if ( item instanceof FunctionLookUpResult ) {
                item.functions.map((func) => ctx.scopeManager.define(func.shortName.split("@")[0], func, this));
            } else {
                ctx.scopeManager.define(this.name.getPlainName(ctx), item, this);
            }
        }
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        this.codegen(ctx);
    }

}
