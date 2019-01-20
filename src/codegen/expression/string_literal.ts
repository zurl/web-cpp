import {Expression, ExpressionResult} from "./expression";
import {SourceLocation} from "../../common/node";
import {CompileContext} from "../context";
import {Type} from "../../type";
import {WGetAddress, WMemoryLocation} from "../../wasm/expression";
import {PointerType} from "../../type/compound_type";
import {CharType} from "../../type/primitive_type";

const __ccharptr = new PointerType(new CharType());
__ccharptr.isConst = true;

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
