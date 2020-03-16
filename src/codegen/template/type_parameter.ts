import {Node, SourceLocation} from "../../common/node";
import {TemplateParameter} from "../../common/template";
import {TemplateType} from "../../type/template_type";
import {TypeName} from "../class/type_name";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";

export interface TemplateParameterDeclaration {
    getTemplateParameter(ctx: CompileContext): TemplateParameter;
}

export class TypeParameter extends Node implements TemplateParameterDeclaration {
    public name: Identifier;
    public init: TypeName | null;

    constructor(location: SourceLocation, name: Identifier, init: TypeName | null) {
        super(location);
        this.name = name;
        this.init = init;
    }

    public getTemplateParameter(ctx: CompileContext): TemplateParameter {
        return {
            name: this.name.getPlainName(ctx),
            type: TemplateType.instance,
            init: this.init ? this.init.deduceType(ctx) : null,
        };
    }
}
