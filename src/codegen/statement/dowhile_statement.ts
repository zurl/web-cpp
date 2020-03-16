import {SourceLocation} from "../../common/node";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WBlock, WBrIf, WLoop, WStatement} from "../../wasm";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {TypeConverter} from "../type_converter";
import {Statement} from "./statement";

export class DoWhileStatement extends Statement {
    public body: Statement;
    public test: Expression;

    constructor(location: SourceLocation, body: Statement, test: Expression) {
        super(location);
        this.body = body;
        this.test = test;
    }

    public codegen(ctx: CompileContext) {
        const doWhileLoop: WStatement[] = [];
        const doWhileBlock: WStatement[] = [];

        const savedContainer = ctx.getStatementContainer();

        // <-- block -->
        ctx.setStatementContainer(doWhileBlock);
        ctx.currentFuncContext.continueStack.push(ctx.currentFuncContext.blockLevel + 2);
        ctx.currentFuncContext.breakStack.push(ctx.currentFuncContext.blockLevel + 1);
        ctx.currentFuncContext.blockLevel += 2;
        this.body.codegen(ctx);
        ctx.currentFuncContext.blockLevel -= 2;
        ctx.currentFuncContext.continueStack.pop();
        ctx.currentFuncContext.breakStack.pop();
        // <-- block -->

        // <-- loop -->
        ctx.setStatementContainer(doWhileLoop);
        ctx.submitStatement(new WBlock(doWhileBlock, this.location));
        const condition = new TypeConverter(this.test.codegen(ctx)).tryConvertTo(ctx, PrimitiveTypes.int32);

        ctx.submitStatement(new WBrIf(0, condition.expr.fold(), this.location));
        // <-- loop -->

        ctx.setStatementContainer(savedContainer);
        ctx.submitStatement(new WLoop(doWhileLoop, this.location));
    }
}
