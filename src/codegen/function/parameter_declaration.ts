import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {TemplateParameter} from "../../common/template";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {Declarator} from "../declaration/declarator";
import {SpecifierList} from "../declaration/specifier_list";
import {AssignmentExpression} from "../expression/assignment_expression";
import {TemplateParameterDeclaration} from "../template/type_parameter";

export class ParameterDeclaration extends Node implements TemplateParameterDeclaration {
    public specifiers: SpecifierList;
    public declarator: Declarator | null;
    public init: AssignmentExpression | null;

    constructor(location: SourceLocation, specifiers: SpecifierList,
                declarator: Declarator | null, init: AssignmentExpression | null) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
        this.init = init;
    }

    public getType(ctx: CompileContext): Type {
        const baseType = this.specifiers.getType(ctx);
        if (this.declarator) {
            return this.declarator.getType(ctx, baseType);
        } else {
            return baseType;
        }
    }

    public getName(ctx: CompileContext): string {
        if (!this.declarator) {
            throw new SyntaxError(`this parameter contains no name`, this);
        }
        return this.declarator.getNameRequired().getPlainName(ctx);
    }

    public getTemplateParameter(ctx: CompileContext): TemplateParameter {
        if (!this.declarator) {
            throw new SyntaxError(`unnamed TemplateParameter`, this);
        }
        return {
            name: this.declarator.getNameRequired().getPlainName(ctx),
            type: this.getType(ctx),
            init: this.init ? this.init.evaluate(ctx) : null,
        };
    }
}
