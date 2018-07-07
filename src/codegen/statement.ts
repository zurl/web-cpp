/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {
    BreakStatement,
    CompoundStatement, ContinueStatement, DoWhileStatement,
    ExpressionResultType,
    ExpressionStatement, ForStatement,
    IfStatement,
    ReturnStatement, WhileStatement,
} from "../common/ast";
import {SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {PrimitiveTypes} from "../common/type";
import {CompileContext} from "./context";
import {loadIntoStack} from "./stack";

CompoundStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    ctx.enterScope(null);
    this.body.map((node) => node.codegen(ctx));
    ctx.exitScope();
};

ExpressionStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    this.expression.codegen(ctx);
};

ReturnStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    // TODO:: return type check;
    if (this.argument != null) {
        const result = this.argument.codegen(ctx);
        loadIntoStack(ctx, result);
    } else {
        // TODO: empty return
    }
    if ( ctx.currentFunction === null) {
        throw new SyntaxError(`return outside function`, this);
    }
    if ( ctx.currentFunction.type.variableArguments) {
        ctx.build(OpCode.RETVARGS, ctx.currentFunction!.parametersSize);
    } else {
        ctx.build(OpCode.RET, ctx.currentFunction!.parametersSize);
    }
};

IfStatement.prototype.codegen = function(ctx: CompileContext) {
    const condition = this.test.codegen(ctx);
    ctx.currentNode = this;
    loadIntoStack(ctx, condition);
    if ( this.alternate === null) {
        const l1 = ctx.currentBuilder!.now;
        ctx.build(OpCode.JZ, 0);
        this.consequent.codegen(ctx);
        const l2 = ctx.currentBuilder!.now;
        ctx.currentBuilder!.codeView.setUint32(l1 + 1, l2 - l1);
    } else {
        const l1 = ctx.currentBuilder!.now;
        ctx.build(OpCode.JZ, 0);
        this.consequent.codegen(ctx);
        const l2 = ctx.currentBuilder!.now;
        ctx.currentNode = this;
        ctx.build(OpCode.J, 0);
        const l3 = ctx.currentBuilder!.now;
        ctx.currentBuilder!.codeView.setUint32(l1 + 1, l3 - l1);
        this.alternate.codegen(ctx);
        const l4 = ctx.currentBuilder!.now;
        ctx.currentBuilder!.codeView.setUint32(l2 + 1, l4 - l2);
    }
};

WhileStatement.prototype.codegen = function(ctx: CompileContext) {
    const saveLoopContext = ctx.loopContext;
    ctx.loopContext = {
        continuePos: [],
        breakPos: [],
    };
    const l1 = ctx.currentBuilder!.now;
    const condition = this.test.codegen(ctx);
    ctx.currentNode = this;
    loadIntoStack(ctx, condition);
    const l2 = ctx.currentBuilder!.now;
    ctx.build(OpCode.JZ, 0);
    this.body.codegen(ctx);
    ctx.currentNode = this;
    const l3 = ctx.currentBuilder!.now;
    ctx.currentNode = this;
    ctx.build(OpCode.J, l1 - l3);
    const l4 = ctx.currentBuilder!.now;
    ctx.currentBuilder!.codeView.setUint32(l2 + 1, l4 - l2);
    ctx.loopContext.breakPos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l4 - line),
    );
    ctx.loopContext.continuePos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l1 - line),
    );
    ctx.loopContext = saveLoopContext;
};

DoWhileStatement.prototype.codegen = function(ctx: CompileContext) {
    const saveLoopContext = ctx.loopContext;
    ctx.loopContext = {
        continuePos: [],
        breakPos: [],
    };
    const l1 = ctx.currentBuilder!.now;
    this.body.codegen(ctx);
    const l2 = ctx.currentBuilder!.now;
    const condition = this.test.codegen(ctx);
    ctx.currentNode = this;
    loadIntoStack(ctx, condition);
    const l3 = ctx.currentBuilder!.now;
    ctx.build(OpCode.JNZ, l3 - l1);
    const l4 = ctx.currentBuilder!.now;
    ctx.currentBuilder!.codeView.setUint32(l2 + 1, l4 - l2);
    ctx.loopContext.breakPos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l4 - line),
    );
    ctx.loopContext.continuePos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l3 - line),
    );
    ctx.loopContext = saveLoopContext;
};

ForStatement.prototype.codegen = function(ctx: CompileContext) {
    const saveLoopContext = ctx.loopContext;
    ctx.loopContext = {
        continuePos: [],
        breakPos: [],
    };

    if (this.init !== null) {
        this.init.codegen(ctx);
    }

    const l1 = ctx.currentBuilder!.now;
    let l2: number;
    if (this.test !== null) {
        const condition = this.test.codegen(ctx);
        ctx.currentNode = this;
        loadIntoStack(ctx, condition);
        l2 = ctx.currentBuilder!.now;
        ctx.build(OpCode.JZ, 0);
    } else {
        l2 = ctx.currentBuilder!.now;
        ctx.build(OpCode.J, 0);
    }

    this.body.codegen(ctx);

    if (this.update) {
        this.update.codegen(ctx);
    }

    ctx.currentNode = this;
    const l3 = ctx.currentBuilder!.now;
    ctx.currentNode = this;
    ctx.build(OpCode.J, l1 - l3);
    const l4 = ctx.currentBuilder!.now;
    ctx.currentBuilder!.codeView.setUint32(l2 + 1, l4 - l2);
    ctx.loopContext.breakPos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l4 - line),
    );
    ctx.loopContext.continuePos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l1 - line),
    );
    ctx.loopContext = saveLoopContext;
};

ContinueStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( !ctx.loopContext ) {
        throw new SyntaxError(`continue is not in while/do-while/for`, this);
    }
    const l0 = ctx.currentBuilder!.now;
    ctx.build(OpCode.J, 0);
    ctx.loopContext.continuePos.push(l0);
};

BreakStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( !ctx.loopContext ) {
        throw new SyntaxError(`break is not in while/do-while/for`, this);
    }
    const l0 = ctx.currentBuilder!.now;
    ctx.build(OpCode.J, 0);
    ctx.loopContext.breakPos.push(l0);
};

export function statement() {
    return "";
}
