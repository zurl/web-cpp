import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {Declarator} from "./declarator";

export class IdentifierDeclarator extends Declarator {
    public identifier: Identifier;

    constructor(location: SourceLocation,
                identifier: Identifier) {
        super(location, null);
        this.identifier = identifier;
    }

    public getType(ctx: CompileContext, baseType: Type): Type {
        return this.declarator ? this.declarator.getType(ctx, baseType) : baseType;
    }

    public getName(): Identifier | null {
        return this.identifier;
    }

}
