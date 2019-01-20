import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {CompileContext} from "../context";
import {ParameterDeclaration} from "./parameter_declaration";

export class ParameterList extends Node {
    public parameters: ParameterDeclaration[];
    public variableArguments: boolean;

    constructor(location: SourceLocation, parameters: ParameterDeclaration[] = [], variableArguments: boolean = false) {
        super(location);
        this.parameters = parameters;
        this.variableArguments = variableArguments;

        // check legal or not of init
        let ix = this.parameters.length - 1;
        for (; ix >= 0; ix--) {
            if (this.parameters[ix].init === null) { break; }
            if (this.variableArguments) {
                throw new SyntaxError(`var argument function could not apply default param`, this);
            }
        }
        ix --;
        for (; ix >= 0; ix--) {
            if (this.parameters[ix].init !== null) {
                throw new SyntaxError(`illegal init expression`, this);
            }
        }
    }

    public getTypeList(ctx: CompileContext): Type[] {
        return this.parameters.map((x) => x.getType(ctx));
    }

    public getNameList(ctx: CompileContext): string[] {
        const result = [] as string[];
        for (const item of this.parameters) {
            if (!item.declarator) {
                throw new SyntaxError(`the parameter list is not complete, some name is missing`, this);
            }
            const id = item.declarator.getNameRequired();
            result.push(id.getPlainName(ctx));
        }
        return result;
    }

    public getInitList(ctx: CompileContext): Array<string | null> {
        return this.parameters.map((x) => x.init ?  x.init.evaluate(ctx) : null);
    }
}
