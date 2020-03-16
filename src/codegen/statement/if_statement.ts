import {SourceLocation} from "../../common/node";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WIfElseBlock} from "../../wasm";
import {WStatement} from "../../wasm";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {TypeConverter} from "../type_converter";
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
        const condition = new TypeConverter(this.test.codegen(ctx)).tryConvertTo(ctx, PrimitiveTypes.int32);

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
