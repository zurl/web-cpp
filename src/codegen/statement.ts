/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {CompileContext} from "./context";
import {
    CompoundStatement,
    ExpressionResultType,
    ExpressionStatement,
    IfStatement,
    ReturnStatement, WhileStatement
} from "../common/ast";
import {OpCode} from "../common/instruction";
import {loadIntoStack} from "./stack";

CompoundStatement.prototype.codegen = function (ctx: CompileContext) {
    ctx.currentNode = this;
    ctx.enterScope(null);
    this.body.map(node => node.codegen(ctx));
    ctx.exitScope();
};
ExpressionStatement.prototype.codegen = function (ctx: CompileContext) {
    ctx.currentNode = this;
    this.expression.codegen(ctx);
};
ReturnStatement.prototype.codegen = function (ctx: CompileContext) {
    ctx.currentNode = this;
    // TODO:: return type check;
    if (this.argument != null) {
        const result = this.argument.codegen(ctx);
        loadIntoStack(ctx, result);
    }
    else{
        //TODO: empty return
    }
    //ctx.build(OpCode.RET);
};

/*
pattern1:
    push expr
    JZ L1
    ..if..
L:
pattern2:
    push expr
L1: JZ L2
    ..if..
    J L3
L2: ..else..
    ...
L3:
 */
IfStatement.prototype.codegen = function (ctx: CompileContext) {
    const condition = this.test.codegen(ctx);
    ctx.currentNode = this;
    loadIntoStack(ctx, condition);
    if( this.alternate === null){
        const l1 = ctx.currentBuilder!.now;
        ctx.build(OpCode.JZ, 0);
        this.consequent.codegen(ctx);
        const l2 = ctx.currentBuilder!.now;
        ctx.currentBuilder!.codeView.setUint32(l1 + 1, l2 - l1);
    }
    else{
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

WhileStatement.prototype.codegen = function (ctx: CompileContext) {
    const l1 = ctx.currentBuilder!.now;
    const condition = this.test.codegen(ctx);
    ctx.currentNode = this;
    loadIntoStack(ctx, condition);
    const l2 = ctx.currentBuilder!.now;
    ctx.build(OpCode.JZ, 0);
    this.body.codegen(ctx);
    ctx.currentNode = this;
    const l3 = ctx.currentBuilder!.now;
    ctx.build(OpCode.J, l3 - l1);
    const l4 = ctx.currentBuilder!.now;
    ctx.currentBuilder!.codeView.setUint32(l2 + 1, l4 - l2);
};

export function statement() {
    const a = 1;
    return "";
}