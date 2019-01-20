import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {FunctionType} from "../../type/function_type";
import {CompileContext} from "../context";
import {Declarator} from "./declarator";
import {ParameterList} from "./parameter_list";

export class FunctionDeclarator extends Declarator {
    public parameters: ParameterList;

    constructor(location: SourceLocation, declarator: Declarator, parameters: ParameterList) {
        super(location, declarator);
        this.parameters = parameters;
    }

    public getType(ctx: CompileContext, baseType: Type): Type {
        const result = new FunctionType(
            baseType,
            this.parameters.parameters.map((x) => x.getType(ctx)),
            this.parameters.variableArguments);
        return this.declarator ? this.declarator.getType(ctx, result) : result;
    }

}
