import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WConst, WType} from "../../wasm";
import {CompileContext} from "../context";
import {Constant} from "./constant";
import {ExpressionResult} from "./expression";

export class CharacterConstant extends Constant {
    public value: string;
    public prefix: string | null;

    constructor(location: SourceLocation, value: string, prefix: string | null) {
        super(location);
        this.value = value;
        this.prefix = prefix;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        return {
            type: PrimitiveTypes.char,
            expr: new WConst(WType.i32, this.value.charCodeAt(0).toString(), this.location),
        };
    }

    public deduceType(ctx: CompileContext): Type {
        return PrimitiveTypes.char;
    }

}
