import {InternalError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {ClassType} from "../../type/class_type";
import {ReferenceType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WGetLocal, WReturn, WSetGlobal, WType} from "../../wasm";
import {WAddressHolder} from "../address";
import {triggerAllDestructor} from "../class/destructor";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {Statement} from "../statement/statement";
import {TypeConverter} from "../type_converter";

export class ReturnStatement extends Statement {
    public argument: Expression | null;

    constructor(location: SourceLocation, argument: Expression | null) {
        super(location);
        this.argument = argument;
    }

    public codegen(ctx: CompileContext): void {
        if (ctx.currentFuncContext.currentFunction === null) {
            throw new SyntaxError(`return outside function`, this);
        }
        // $sp = sp
        triggerAllDestructor(ctx, this);

        ctx.submitStatement(
            new WSetGlobal(WType.u32, "$sp",
                new WGetLocal(WType.u32, ctx.currentFuncContext.currentFunction.$sp, this.location), this.location));

        if (this.argument !== null) {
            const returnType = ctx.currentFuncContext.currentFunction.type.returnType;
            if (returnType.equals(PrimitiveTypes.void)) {
                throw new SyntaxError(`return type mismatch`, this);
            }
            let expr = this.argument.codegen(ctx);
            if (returnType instanceof ClassType || returnType instanceof ReferenceType) {
                expr = new TypeConverter(expr).removeReference(ctx);
                if (!(expr.expr instanceof WAddressHolder)) {
                    throw new InternalError(`class / ref must be lavlue`);
                }
                ctx.submitStatement(new WReturn(expr.expr.createLoadAddress(ctx), this.location));
            } else {
                expr = new TypeConverter(expr)
                    .tryConvertTo(ctx, ctx.currentFuncContext.currentFunction.type.returnType);
                ctx.submitStatement(new WReturn(expr.expr.fold(), this.location));
            }
        } else {
            if (!ctx.currentFuncContext.currentFunction.type.returnType.equals(PrimitiveTypes.void)) {
                throw new SyntaxError(`return type mismatch`, this);
            }
            ctx.submitStatement(new WReturn(null, this.location));
        }
    }

}
