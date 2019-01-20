import {Node, SourceLocation} from "../../common/node";
import {LanguageError, SyntaxError} from "../../common/error";
import {Type} from "../../type";
import {LeftReferenceType, PointerType, ReferenceType} from "../../type/compound_type";
import {CompileContext} from "../context";
import {Declarator} from "./declarator";

export class PointerDeclarator extends Declarator {
    public pointer: Pointer;

    constructor(location: SourceLocation, declarator: Declarator, pointer: Pointer) {
        super(location, declarator);
        this.pointer = pointer;
    }

    public getType(ctx: CompileContext, baseType: Type): Type {
        let pointer = this.pointer as Pointer | null;
        let result = baseType;
        while (pointer != null) {
            if ( result instanceof ReferenceType) {
                throw new SyntaxError(`there is no pointer/reference of reference`, this);
            }
            if ( pointer.type === "*" ) {
                result = new PointerType(result);
            } else if ( pointer.type === "&" ) {
                if ( !ctx.isCpp() ) {
                    throw new LanguageError(`reference is only supported in c++`, this);
                }
                result = new LeftReferenceType(result);
            } else if ( pointer.type === "&&" ) {
                throw new SyntaxError(`unsupport right value reference`, this);
            }
            pointer = pointer.pointer;
        }
        return this.declarator ? this.declarator.getType(ctx, result) : result;
    }
}


export class Pointer extends Node {
    public qualifiers: string[];
    public pointer: Pointer | null;
    public type: string;

    constructor(location: SourceLocation, qualifiers: string[], pointer: Pointer | null, type: string) {
        super(location);
        this.qualifiers = qualifiers;
        this.pointer = pointer;
        this.type = type;
    }
}