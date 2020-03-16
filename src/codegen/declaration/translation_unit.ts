import {Directive, SourceLocation} from "../../common/node";
import {Node} from "../../common/node";
import {CompileContext} from "../context";

export class TranslationUnit extends Node {
    public body: Directive[];

    constructor(location: SourceLocation, body: Directive[]) {
        super(location);
        this.body = body;
    }

    public codegen(ctx: CompileContext) {
        this.body.map((x) => x.codegen(ctx));
    }
}
