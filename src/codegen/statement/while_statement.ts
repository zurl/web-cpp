import {SourceLocation} from "../../common/node";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WStatement} from "../../wasm/node";
import {WBlock, WBr, WBrIf, WLoop} from "../../wasm/statement";
import {CompileContext} from "../context";
import {doConversion} from "../conversion";
import {Expression} from "../expression/expression";
import {UnaryExpression} from "../expression/unary_expression";
import {Statement} from "./statement";

export class WhileStatement extends Statement {
    public test: Expression;
    public body: Statement;

    constructor(location: SourceLocation, test: Expression, body: Statement) {
        super(location);
        this.test = test;
        this.body = body;
    }
    public codegen(ctx: CompileContext) {
        const whileBlock: WStatement[] = [];
        const whileLoop: WStatement[] = [];
        const savedContainer = ctx.getStatementContainer();

        // <-- loop -->
        ctx.setStatementContainer(whileLoop);
        const condition = new UnaryExpression(this.location,
            "!", this.test).codegen(ctx);
        condition.expr = doConversion(ctx, PrimitiveTypes.int32, condition, this);
        condition.type = PrimitiveTypes.int32;
        ctx.submitStatement(new WBrIf(1, condition.expr.fold(), this.location));
        ctx.currentFuncContext.continueStack.push(ctx.currentFuncContext.blockLevel + 2);
        ctx.currentFuncContext.breakStack.push(ctx.currentFuncContext.blockLevel + 1);
        ctx.currentFuncContext.blockLevel += 2;
        this.body.codegen(ctx);
        ctx.currentFuncContext.blockLevel -= 2;
        ctx.currentFuncContext.breakStack.pop();
        ctx.currentFuncContext.continueStack.pop();
        ctx.submitStatement(new WBr(0, this.location));
        // <-- loop -->

        // <-- block -->
        ctx.setStatementContainer(whileBlock);
        ctx.submitStatement(new WLoop(whileLoop, this.location));
        // <-- block -->

        ctx.setStatementContainer(savedContainer);
        ctx.submitStatement(new WBlock(whileBlock, this.location));
    }
}
