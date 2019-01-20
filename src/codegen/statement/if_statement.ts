import {SourceLocation} from "../../common/node";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WIfElseBlock} from "../../wasm";
import {WStatement} from "../../wasm/node";
import {CompileContext} from "../context";
import {doConversion} from "../conversion";
import {Expression} from "../expression/expression";
import {Statement} from "./statement";

export class IfStatement extends Statement {
    public test: Expression;
    public consequent: Statement;
    public alternate: Statement | null;

    constructor(location: SourceLocation, test: Expression, consequent: Statement, alternate: Statement | null) {
        super(location);
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }

    public codegen(ctx: CompileContext): void {
        const thenStatements: WStatement[] = [];
        const elseStatements: WStatement[] = [];
        const condition = this.test.codegen(ctx);

        condition.expr = doConversion(ctx, PrimitiveTypes.int32, condition, this);
        condition.type = PrimitiveTypes.int32;

        const savedContainer = ctx.getStatementContainer();
        ctx.setStatementContainer(thenStatements);
        ctx.currentFuncContext.blockLevel++;
        this.consequent.codegen(ctx);
        if (this.alternate !== null) {
            ctx.setStatementContainer(elseStatements);
            this.alternate.codegen(ctx);
        }
        ctx.setStatementContainer(savedContainer);
        ctx.currentFuncContext.blockLevel--;
        if (this.alternate !== null) {
            ctx.submitStatement(new WIfElseBlock(condition.expr.fold(), thenStatements,
                elseStatements, this.location));
        } else {
            ctx.submitStatement(new WIfElseBlock(condition.expr.fold(), thenStatements,
                null, this.location));
        }
    }
}
