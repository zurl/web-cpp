import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {getAccessControlFromString} from "../../type";
import {ClassType, Inheritance} from "../../type/class_type";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";

export class BaseSpecifier extends Node {
    public accessControl: string;
    public className: Identifier;

    constructor(location: SourceLocation, accessControl: string, className: Identifier) {
        super(location);
        this.accessControl = accessControl;
        this.className = className;
    }

    public codegen(ctx: CompileContext): Inheritance {
        const accessControl = getAccessControlFromString(this.accessControl);
        const classType = ctx.scopeManager.lookup(this.className.getLookupName(ctx));
        if (!(classType instanceof ClassType)) {
            throw new SyntaxError(`you could not inherit type ${classType}, which is not a class type`, this);
        }
        if (!classType.isComplete) {
            throw new SyntaxError(`you could not inherit type ${classType}, which is incomplete`, this);
        }
        return {
            classType,
            accessControl,
        };
    }

}
