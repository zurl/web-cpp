import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WConst} from "../../wasm";
import {CompileContext} from "../context";
import {Constant} from "./constant";
import {ExpressionResult} from "./expression";

export class FloatingConstant extends Constant {
    public value: number;
    public raw: string;
    public suffix: string | null;

    constructor(location: SourceLocation, value: number, raw: string, suffix: string | null) {
        super(location);
        this.value = value;
        this.raw = raw;
        this.suffix = suffix;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const type = this.deduceType(ctx);
        return {
            type,
            expr: new WConst(type.toWType(), this.raw, this.location),
            isLeft: false,
        };
    }

    public deduceType(ctx: CompileContext): Type {
        if (this.suffix && this.suffix.toUpperCase() === "F") {
            return PrimitiveTypes.float;
        } else {
            return PrimitiveTypes.double;
        }
    }

}
