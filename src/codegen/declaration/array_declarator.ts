import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ArrayType, ReferenceType} from "../../type/compound_type";
import {IntegerType} from "../../type/primitive_type";
import {WConst, WExpression} from "../../wasm";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {Declarator} from "./declarator";

export class ArrayDeclarator extends Declarator {
    public static: boolean;
    public qualifiers: string[];
    public length: Expression;
    public variableLength: boolean;

    constructor(location: SourceLocation, declarator: Declarator,
                isStatic: boolean, qualifiers: string[], length: Expression,
                variableLength: boolean) {
        super(location, declarator);
        this.static = isStatic;
        this.qualifiers = qualifiers;
        this.length = length;
        this.variableLength = variableLength;
    }

    public getType(ctx: CompileContext, baseType: Type): Type {
        if ( baseType instanceof ReferenceType) {
            throw new SyntaxError(`there is no array of reference`, this);
        }
        if ( !this.length ) {
            return new ArrayType(baseType, 0);
        }
        const length = this.length.codegen(ctx);
        length.expr = length.expr.fold();
        if (!(length.expr instanceof WConst)) {
            throw new SyntaxError("var length array is not support currently", this);
        }
        if (!(length.type instanceof IntegerType)) {
            throw new SyntaxError("length of array must be integer", this);
        }
        if (this.qualifiers.length !== 0) {
            ctx.raiseWarning("unsupport array qualifier", this);
        }
        const result = new ArrayType(baseType, parseInt(length.expr.constant));
        return this.declarator ? this.declarator.getType(ctx, result) : result;
    }
}
