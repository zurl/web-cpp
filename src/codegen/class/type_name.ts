import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {Declarator} from "../declaration/declarator";
import {SpecifierList} from "../declaration/specifier_list";

export class TypeName extends Node {
    public specifierQualifiers: SpecifierList;
    public declarator: Declarator | null;

    constructor(location: SourceLocation, specifierQualifiers: SpecifierList, declarator: Declarator | null) {
        super(location);
        this.specifierQualifiers = specifierQualifiers;
        this.declarator = declarator;
    }

    public deduceType(ctx: CompileContext): Type {
        const baseType = this.specifierQualifiers.getType(ctx);
        return this.declarator ? this.declarator.getType(ctx, baseType) : baseType;
    }
}
