import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {IntegerType} from "../../type/primitive_type";
import {WConst} from "../../wasm";
import {CaseContext, CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {FunctionLookUpResult} from "../scope";
import {Statement} from "./statement";

export class CaseStatement extends Statement {
    public test: Expression;
    public body: Statement;
    constructor(location: SourceLocation, test: Expression, body: Statement) {
        super(location);
        this.test = test;
        this.body = body;
    }

    public codegen(ctx: CompileContext): void {
        if (ctx.currentFuncContext.switchContext === null) {
            throw new SyntaxError(`case out of switch`, this);
        }
        const caseCtx: CaseContext = {value: null, statements: []};
        ctx.currentFuncContext.switchContext.cases.push(caseCtx);
        if (this.test !== null) {
            const expr = this.test.codegen(ctx);
            if (expr.expr instanceof FunctionLookUpResult) {
                throw new SyntaxError(`func name not support`, this);
            }
            expr.expr = expr.expr.fold();
            if (!(expr.expr instanceof WConst) || !(expr.type instanceof IntegerType)) {
                throw new SyntaxError(`case value must be integer or enum`, this);
            }
            caseCtx.value = expr.expr;
        }
        ctx.setStatementContainer(caseCtx.statements);
        ctx.currentFuncContext.blockLevel--;
        this.body.codegen(ctx);
    }
}
