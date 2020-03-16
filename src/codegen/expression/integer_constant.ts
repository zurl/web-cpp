import * as Long from "long";
import {EmptyLocation, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WConst} from "../../wasm";
import {CompileContext} from "../context";
import {Constant} from "./constant";
import {ExpressionResult} from "./expression";

export class IntegerConstant extends Constant {

    public static ZeroConstant: Constant;

    public static OneConstant: Constant;

    public static NegOneConstant: Constant;

    public static fromNumber(location: SourceLocation, number: number) {
        return new IntegerConstant(
            location,
            10,
            Long.fromInt(number),
            number.toString(),
            null,
        );
    }

    public base: number;
    public value: Long;
    public raw: string;
    public suffix: string | null;

    constructor(location: SourceLocation, base: number, value: Long, raw: string, suffix: string | null) {
        super(location);
        this.base = base;
        this.value = value;
        this.raw = raw;
        this.suffix = suffix;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const type = this.deduceType(ctx);
        return {
            type,
            expr: new WConst(type.toWType(), this.raw, this.location),
        };
    }

    public deduceType(ctx: CompileContext): Type {
        let type = PrimitiveTypes.int32;
        if (this.suffix) {
            if (this.suffix.toUpperCase().indexOf("U") !== -1) {
                if (this.suffix.toUpperCase().indexOf("LL") !== -1) {
                    type = PrimitiveTypes.uint64;
                } else {
                    type = PrimitiveTypes.uint32;
                }
            } else {
                if (this.suffix.toUpperCase().indexOf("LL") !== -1) {
                    type = PrimitiveTypes.int64;
                } else {
                    type = PrimitiveTypes.int32;
                }
            }
        }
        return type;
    }
}

IntegerConstant.ZeroConstant = IntegerConstant.fromNumber(EmptyLocation, 0);

IntegerConstant.OneConstant = IntegerConstant.fromNumber(EmptyLocation, 1);

IntegerConstant.NegOneConstant = IntegerConstant.fromNumber(EmptyLocation, -1);
