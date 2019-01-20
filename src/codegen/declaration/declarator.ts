import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {FunctionDeclarator} from "./function_declarator";

export abstract class Declarator extends Node {
    public declarator: Declarator | null;

    constructor(location: SourceLocation, declarator: Declarator | null) {
        super(location);
        this.declarator = declarator;
    }

    public abstract getType(ctx: CompileContext, baseType: Type): Type;

    public getName(): Identifier | null {
        return this.declarator ? this.declarator.getName() : null;
    }

    public getNameRequired(): Identifier {
        if (!this.declarator) {
            throw new SyntaxError(`the name is missing`, this);
        }
        const name = this.declarator.getName();
        if (!name) {
            throw new SyntaxError(`the name is missing`, this);
        }
        return name;
    }

    public getFunctionDeclarator(): FunctionDeclarator | null {
        return this instanceof FunctionDeclarator ? this :
            (this.declarator ? this.declarator.getFunctionDeclarator() : null);
    }
}
