import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType} from "../../common/symbol";
import {IntegerType, PrimitiveTypes} from "../../type/primitive_type";
import {I32Binary, WBinaryOperation, WBlock} from "../../wasm";
import {WBr, WBrIf, WStatement} from "../../wasm";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {TypeConverter} from "../type_converter";
import {CaseStatement} from "./case_statement";
import {CompoundStatement} from "./compound_statement";
import {Statement} from "./statement";

export class SwitchStatement extends Statement {
    public discriminant: Expression;
    public body: CompoundStatement;

    constructor(location: SourceLocation, discriminant: Expression, body: CompoundStatement) {
        super(location);
        this.discriminant = discriminant;
        this.body = body;
    }

    public codegen(ctx: CompileContext) {
        const savedSwitchContext = ctx.currentFuncContext.switchContext;
        const savedStatementContainer = ctx.getStatementContainer();
        const mockContainer: WStatement[] = [];
        ctx.setStatementContainer(mockContainer);
        ctx.currentFuncContext.switchContext = {cases: []};
        if (mockContainer.length !== 0) {
            throw new SyntaxError(`illegal content in switch out side all case`, this);
        }
        const caseCount = this.body.body.filter((x) => x instanceof CaseStatement).length;
        let defaultBreakLevel = caseCount;
        ctx.currentFuncContext.breakStack.push(ctx.currentFuncContext.blockLevel);
        ctx.currentFuncContext.blockLevel += caseCount;
        this.body.codegen(ctx);
        const defaultBranches = ctx.currentFuncContext.switchContext.cases.filter((x) => x.value === null);
        if (defaultBranches.length > 1) {
            throw new SyntaxError(`only 1 default case is support`, this);
        }
        if (defaultBranches.length === 1) {
            for (let i = 0; i < ctx.currentFuncContext.switchContext.cases.length; i++) {
                if (ctx.currentFuncContext.switchContext.cases[i].value === null) {
                    defaultBreakLevel = i;
                    break;
                }
            }
        }
        const tmpVarLoc = ctx.memory.allocStack(4);
        const tmpVarPtr = new WAddressHolder(tmpVarLoc, AddressType.STACK, this.location);
        const cond = new TypeConverter(this.discriminant.codegen(ctx)).tryConvertTo(ctx, PrimitiveTypes.int32);
        if (!(cond.type instanceof IntegerType)) {
            throw new SyntaxError(`illegal switch cond type`, this);
        }
        ctx.setStatementContainer(savedStatementContainer);
        ctx.submitStatement(tmpVarPtr.createStore(ctx, cond.type, cond.expr, true));
        let currentBlock = new WBlock([], this.location);
        const condExpr = tmpVarPtr.createLoad(ctx, cond.type);
        for (let i = 0; i < ctx.currentFuncContext.switchContext.cases.length; i++) {
            const val = ctx.currentFuncContext.switchContext.cases[i].value;
            if (val !== null) {
                currentBlock.body.push(new WBrIf(i, new WBinaryOperation(
                    I32Binary.eq,
                    condExpr,
                    val,
                    this.location,
                ), this.location));
            }
        }
        currentBlock.body.push(new WBr(defaultBreakLevel, this.location));
        for (let i = 0; i < ctx.currentFuncContext.switchContext.cases.length; i++) {
            currentBlock = new WBlock([currentBlock,
                ...ctx.currentFuncContext.switchContext.cases[i].statements], this.location);
        }
        ctx.submitStatement(currentBlock);
        ctx.currentFuncContext.switchContext = savedSwitchContext;

    }
}
