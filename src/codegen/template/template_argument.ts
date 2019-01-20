import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {TypeName} from "../class/type_name";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";

export type EvaluatedTemplateArgument = string | Type;

export class TemplateArgument extends Node {
    public body: TypeName | Expression;

    constructor(location: SourceLocation, body: TypeName | Expression) {
        super(location);
        this.body = body;
    }

    public evaluate(ctx: CompileContext): EvaluatedTemplateArgument {
        if (this.body instanceof TypeName) {
            return this.body.deduceType(ctx);
        } else {
            return this.body.evaluate(ctx);
        }
    }
}
