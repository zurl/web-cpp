import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {PointerType} from "../../type/compound_type";
import {CharType} from "../../type/primitive_type";
import {CompileContext} from "../context";
import {Expression, ExpressionResult} from "./expression";
import {WGetAddress, WMemoryLocation} from "../../wasm";

const __ccharptr = new PointerType(new CharType());

export class StringLiteral extends Expression {
    public prefix: string | null;
    public value: string;

    constructor(location: SourceLocation, prefix: string | null, value: string) {
        super(location);
        this.prefix = prefix;
        this.value = value;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const expr = new WGetAddress(WMemoryLocation.DATA, this.location);
        expr.offset = ctx.memory.allocString(this.value);
        return {
            type: __ccharptr,
            expr,
            isLeft: false,
        };
    }

    public deduceType(ctx: CompileContext): Type {
        return __ccharptr;
    }

}
