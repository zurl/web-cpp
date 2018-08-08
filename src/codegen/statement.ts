/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {
    AssignmentExpression, BinaryExpression,
    BreakStatement,
    CallExpression,
    CaseStatement,
    CompoundStatement,
    ContinueStatement,
    Declaration,
    DeleteStatement,
    DoWhileStatement,
    ExpressionResult,
    ExpressionStatement,
    ForStatement,
    GotoStatement,
    Identifier,
    IfStatement,
    LabeledStatement,
    MemberExpression,
    NameSpaceBlock,
    Node,
    SwitchStatement,
    UnaryExpression,
    UsingItemStatement,
    UsingNamespaceStatement,
    UsingStatement,
    WhileStatement,
} from "../common/ast";
import {LanguageError, SyntaxError} from "../common/error";
import {AddressType, Variable} from "../common/symbol";
import {ClassType} from "../type/class_type";
import {PointerType} from "../type/compound_type";
import {IntegerType, PrimitiveTypes} from "../type/primitive_type";
import {I32Binary, WBinaryOperation, WConst, WType} from "../wasm";
import {WStatement} from "../wasm/node";
import {WBlock, WBr, WBrIf, WDrop, WExprStatement, WIfElseBlock, WLoop} from "../wasm/statement";
import {WAddressHolder} from "./address";
import {CaseContext, CompileContext} from "./context";
import {doConversion, doValueTransform} from "./conversion";
import {FunctionLookUpResult} from "./scope";

export function recycleExpressionResult(ctx: CompileContext, node: Node, expr: ExpressionResult) {
    if (expr.expr instanceof FunctionLookUpResult) {
        throw new SyntaxError(`illegal function name`, node);
    }
    if (expr.isLeft && expr.expr.isPure()) {
        return;
    }
    if (expr.type.equals(PrimitiveTypes.void)) {
        ctx.submitStatement(new WExprStatement(expr.expr.fold(), node.location));
    } else {
        ctx.submitStatement(new WDrop(expr.expr.fold(), node.location));
    }
}

CompoundStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.enterScope();
    this.body.map((node) => node.codegen(ctx));
    ctx.exitScope(this);
};

LabeledStatement.prototype.codegen = function(ctx: CompileContext) {
    this.body.codegen(ctx);
};

GotoStatement.prototype.codegen = function(ctx: CompileContext) {
    throw new SyntaxError("goto statement is not support currently", this);
};

SwitchStatement.prototype.codegen = function(ctx: CompileContext) {
    // Performance problem
    const savedSwitchContext = ctx.switchContext;
    const savedStatementContainer = ctx.getStatementContainer();
    const mockContainer: WStatement[] = [];
    ctx.setStatementContainer(mockContainer);
    ctx.switchContext = {cases: []};
    if (mockContainer.length !== 0) {
        throw new SyntaxError(`illegal content in switch out side all case`, this);
    }
    if (!(this.body instanceof CompoundStatement)) {
        throw new SyntaxError(`switch body must be compoundstatement`, this);
    }
    const caseCount = this.body.body.filter((x) => x instanceof CaseStatement).length;
    let defaultBreakLevel = caseCount;
    ctx.breakStack.push(ctx.blockLevel);
    ctx.blockLevel += caseCount;
    this.body.codegen(ctx);
    const defaultBranches = ctx.switchContext.cases.filter((x) => x.value === null);
    if (defaultBranches.length > 1) {
        throw new SyntaxError(`only 1 default case is support`, this);
    }
    if (defaultBranches.length === 1) {
        for (let i = 0; i < ctx.switchContext.cases.length; i++) {
            if (ctx.switchContext.cases[i].value === null) {
                defaultBreakLevel = i;
                break;
            }
        }
    }
    const tmpVarLoc = ctx.memory.allocStack(4);
    const tmpVarPtr = new WAddressHolder(tmpVarLoc, AddressType.STACK, this.location);
    const cond = doValueTransform(ctx, this.discriminant.codegen(ctx), this);
    if (!(cond.type instanceof IntegerType) || cond.expr instanceof FunctionLookUpResult) {
        throw new SyntaxError(`illegal switch cond type`, this);
    }
    ctx.setStatementContainer(savedStatementContainer);
    ctx.submitStatement(tmpVarPtr.createStore(ctx, cond.type, cond.expr, true));
    let currentBlock = new WBlock([], this.location);
    const condExpr = tmpVarPtr.createLoad(ctx, cond.type);
    for (let i = 0; i < ctx.switchContext.cases.length; i++) {
        const val = ctx.switchContext.cases[i].value;
        if (val !== null) {
            currentBlock.body.push(new WBrIf(i, new WBinaryOperation(
                I32Binary.eq,
                condExpr,
                val,
            )));
        }
    }
    currentBlock.body.push(new WBr(defaultBreakLevel, this.location));
    for (let i = 0; i < ctx.switchContext.cases.length; i++) {
        currentBlock = new WBlock([currentBlock,
            ...ctx.switchContext.cases[i].statements], this.location);
    }
    ctx.submitStatement(currentBlock);
    ctx.switchContext = savedSwitchContext;
};

CaseStatement.prototype.codegen = function(ctx: CompileContext) {
    if (ctx.switchContext === null) {
        throw new SyntaxError(`case out of switch`, this);
    }
    const caseCtx: CaseContext = {value: null, statements: []};
    ctx.switchContext.cases.push(caseCtx);
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
    ctx.blockLevel--;
    this.body.codegen(ctx);
};

ExpressionStatement.prototype.codegen = function(ctx: CompileContext) {
    recycleExpressionResult(ctx, this, this.expression.codegen(ctx));
};
IfStatement.prototype.codegen = function(ctx: CompileContext) {
    const thenStatements: WStatement[] = [];
    const elseStatements: WStatement[] = [];
    const condition = this.test.codegen(ctx);

    condition.expr = doConversion(ctx, PrimitiveTypes.int32, condition, this);
    condition.type = PrimitiveTypes.int32;

    const savedContainer = ctx.getStatementContainer();
    ctx.setStatementContainer(thenStatements);
    ctx.blockLevel++;
    this.consequent.codegen(ctx);
    if (this.alternate !== null) {
        ctx.setStatementContainer(elseStatements);
        this.alternate.codegen(ctx);
    }
    ctx.setStatementContainer(savedContainer);
    ctx.blockLevel--;
    if (this.alternate !== null) {
        ctx.submitStatement(new WIfElseBlock(condition.expr.fold(), thenStatements,
            elseStatements, this.location));
    } else {
        ctx.submitStatement(new WIfElseBlock(condition.expr.fold(), thenStatements,
            null, this.location));
    }
};

/*
block{
    loop{
        int cond = !getcond();
        br_if 0
        ...content
        continue => br_0
        break => br_1
        br 0
    }
}
 */
WhileStatement.prototype.codegen = function(ctx: CompileContext) {
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
    ctx.continueStack.push(ctx.blockLevel + 2);
    ctx.breakStack.push(ctx.blockLevel + 1);
    ctx.blockLevel += 2;
    this.body.codegen(ctx);
    ctx.blockLevel -= 2;
    ctx.breakStack.pop();
    ctx.continueStack.pop();
    ctx.submitStatement(new WBr(0, this.location));
    // <-- loop -->

    // <-- block -->
    ctx.setStatementContainer(whileBlock);
    ctx.submitStatement(new WLoop(whileLoop, this.location));
    // <-- block -->

    ctx.setStatementContainer(savedContainer);
    ctx.submitStatement(new WBlock(whileBlock, this.location));
};

/*
loop{
    block{
        ...content
        continue => br_0
        break => br_1
    }
    int cond = getcond();
    br_if 0
}
 */
DoWhileStatement.prototype.codegen = function(ctx: CompileContext) {
    const doWhileLoop: WStatement[] = [];
    const doWhileBlock: WStatement[] = [];

    const savedContainer = ctx.getStatementContainer();

    // <-- block -->
    ctx.setStatementContainer(doWhileBlock);
    ctx.continueStack.push(ctx.blockLevel + 2);
    ctx.breakStack.push(ctx.blockLevel + 1);
    ctx.blockLevel += 2;
    this.body.codegen(ctx);
    ctx.blockLevel -= 2;
    ctx.continueStack.pop();
    ctx.breakStack.pop();
    // <-- block -->

    // <-- loop -->
    ctx.setStatementContainer(doWhileLoop);
    ctx.submitStatement(new WBlock(doWhileBlock, this.location));
    const condition = this.test.codegen(ctx);
    condition.expr = doConversion(ctx, PrimitiveTypes.int32, condition, this);
    condition.type = PrimitiveTypes.int32;
    ctx.submitStatement(new WBrIf(0, condition.expr.fold(), this.location));
    // <-- loop -->

    ctx.setStatementContainer(savedContainer);
    ctx.submitStatement(new WLoop(doWhileLoop, this.location));
};

/*
...init
block{
    loop{
        int cond = getcond();
        br_if 1
        block{
            ...content
            continue => br_0
            break => br_2
        }
        do update
        br 0
    }
}
 */
ForStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.enterScope();
    if (this.init !== null) {
        if (this.init instanceof Declaration) {
            this.init.codegen(ctx);
        } else {
            recycleExpressionResult(ctx, this, this.init.codegen(ctx));
        }
    }

    const outerBlockStatements: WStatement[] = [];
    const innerBlockStatements: WStatement[] = [];
    const loopStatements: WStatement[] = [];

    const savedContainer = ctx.getStatementContainer();
    // <-- inner block -->
    ctx.setStatementContainer(innerBlockStatements);
    ctx.continueStack.push(ctx.blockLevel + 3);
    ctx.breakStack.push(ctx.blockLevel + 1);
    ctx.blockLevel += 3;
    if (this.body instanceof CompoundStatement) {
        this.body.body.map((x) => x.codegen(ctx));
    } else {
        this.body.codegen(ctx);
    }
    ctx.blockLevel += 3;
    ctx.continueStack.pop();
    ctx.breakStack.pop();
    // <-- inner block -->

    // <-- loop -->
    ctx.setStatementContainer(loopStatements);
    if (this.test !== null) {
        const condition = new UnaryExpression(this.location,
            "!", this.test).codegen(ctx);
        condition.expr = doConversion(ctx, PrimitiveTypes.int32, condition, this);
        condition.type = PrimitiveTypes.int32;
        ctx.submitStatement(new WBrIf(1, condition.expr.fold(), this.location));
    }
    ctx.submitStatement(new WBlock(innerBlockStatements, this.location));
    if (this.update !== null) {
        recycleExpressionResult(ctx, this, this.update.codegen(ctx));
    }
    ctx.submitStatement(new WBr(0, this.location));
    // <-- loop -->

    // <-- outer block -->
    ctx.setStatementContainer(outerBlockStatements);
    ctx.submitStatement(new WLoop(loopStatements, this.location));
    // <-- outer block -->

    ctx.setStatementContainer(savedContainer);
    ctx.submitStatement(new WBlock(outerBlockStatements, this.location));
    ctx.exitScope(this);
};

ContinueStatement.prototype.codegen = function(ctx: CompileContext) {
    if (ctx.continueStack.length === 0) {
        throw new SyntaxError(`continue is not in while/do-while/for`, this);
    }
    const item = ctx.continueStack[ctx.continueStack.length - 1];
    ctx.submitStatement(new WBr(ctx.blockLevel - item, this.location));
};

BreakStatement.prototype.codegen = function(ctx: CompileContext) {
    if (ctx.breakStack.length === 0) {
        throw new SyntaxError(`break is not in while/do-while/for`, this);
    }
    const item = ctx.breakStack[ctx.breakStack.length - 1];
    ctx.submitStatement(new WBr(ctx.blockLevel - item, this.location));
};

DeleteStatement.prototype.codegen = function(ctx: CompileContext) {
    if (!ctx.isCpp()) {
        throw new LanguageError(`delete is only support in c++`, this);
    }
    const rightType = this.expr.deduceType(ctx);
    if (!(rightType instanceof PointerType)) {
        throw new SyntaxError(`you could only delete pointer`, this);
    }
    if (this.isArrayDelete) {
        const sizeVarName = ctx.scopeManager.allocTmpVarName();
        const sizeVar = new Variable(sizeVarName, sizeVarName, this.location.fileName, PrimitiveTypes.int32,
            AddressType.STACK, ctx.memory.allocStack(PrimitiveTypes.int32.length));
        ctx.scopeManager.define(sizeVarName, sizeVar, this);

        const ptrVarName = ctx.scopeManager.allocTmpVarName();
        const ptrVar = new Variable(ptrVarName, ptrVarName, this.location.fileName, rightType,
            AddressType.STACK, ctx.memory.allocStack(rightType.length));
        ctx.scopeManager.define(ptrVarName, ptrVar, this);
        // // TODO::
        // // TODO::
        // // TODO::
        throw 1;
        // ptr = ptr
        const assignSizeExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, ptrVarName), this.expr).codegen(ctx);
        recycleExpressionResult(ctx, this, assignSizeExpr);

        if (rightType.elementType instanceof ClassType) {

        }

        new ExpressionStatement(this.location, new CallExpression(
            this.location, new Identifier(this.location, "free"),
            [new Identifier(this.location, ptrVarName)],
        )).codegen(ctx);
    } else {
        if (rightType.elementType instanceof ClassType) {
            const tmpVarName = ctx.scopeManager.allocTmpVarName();
            const tmpVar = new Variable(tmpVarName, tmpVarName, this.location.fileName, rightType,
                AddressType.STACK, ctx.memory.allocStack(rightType.length));
            ctx.scopeManager.define(tmpVarName, tmpVar, this);

            new AssignmentExpression(this.location, "=",
                new Identifier(this.location, tmpVarName), this.expr).codegen(ctx);

            new ExpressionStatement(this.location, new CallExpression(this.location,
                new MemberExpression(this.location, new Identifier(this.location, tmpVarName),
                    true, new Identifier(this.location, "~" + rightType.elementType.name)),
                [])).codegen(ctx);

            new ExpressionStatement(this.location, new CallExpression(this.location,
                new Identifier(this.location, "::free"), [
                    new Identifier(this.location, tmpVarName),
                ])).codegen(ctx);
        } else {
            new ExpressionStatement(this.location, new CallExpression(
                this.location, new Identifier(this.location, "::free"),
                [this.expr],
            )).codegen(ctx);
        }
    }
};

UsingStatement.prototype.codegen = function(ctx: CompileContext) {
    const type = this.type.deduceType(ctx);
    ctx.scopeManager.define(this.name.name, type, this);
};

NameSpaceBlock.prototype.codegen = function(ctx: CompileContext) {
    ctx.scopeManager.enterScope(this.namespace.name);
    this.statements.map((x) => x.codegen(ctx));
    ctx.exitScope(this);
};

UsingNamespaceStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( !ctx.scopeManager.activeScope(this.namespace.name)) {
        throw new SyntaxError(`${this.namespace.name} is not a namespace / class`, this);
    }
};

UsingItemStatement.prototype.codegen = function(ctx: CompileContext) {
    const item = ctx.scopeManager.lookupAnyName(this.identifier.name);
    if ( item === null ) {
        throw new SyntaxError(`undefine symbol ${this.identifier.name}`, this);
    }
    const tokens = this.identifier.name.split("::");
    if ( item instanceof FunctionLookUpResult ) {
        item.functions.map((func) => ctx.scopeManager.define(func.name, func));
    } else {
        ctx.scopeManager.define(tokens[tokens.length - 1], item, this);
    }
};

export function statement() {
    return "";
}
