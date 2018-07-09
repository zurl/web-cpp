/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import * as Long from "long";
import {
    BreakStatement, CaseStatement,
    CompoundStatement, ContinueStatement, Declaration, DoWhileStatement, ExpressionResult,
    ExpressionResultType,
    ExpressionStatement, ForStatement, GotoStatement,
    IfStatement, LabeledStatement,
    ReturnStatement, SwitchStatement, WhileStatement,
} from "../common/ast";
import {SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {extractRealType, IntegerType, PointerType, PrimitiveTypes} from "../common/type";
import {CompileContext} from "./context";
import {convertTypeOnStack, loadIntoStack, popFromStack, recycleExpressionResult} from "./stack";

CompoundStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    ctx.enterScope(null);
    this.body.map((node) => node.codegen(ctx));
    ctx.exitScope();
};

LabeledStatement.prototype.codegen = function(ctx: CompileContext) {
    const item = ctx.labelMap.get(this.label.name);
    if (item !== undefined) {
        throw new SyntaxError(`duplicated label ${this.label.name}`, this);
    }
    const t0 = ctx.currentBuilder.now;
    ctx.labelMap.set(this.label.name, t0);
    const unresolvedLabels = ctx.unresolveGotoMap.get(this.label.name);
    if (unresolvedLabels !== undefined) {
        unresolvedLabels.map( (loc) => {
            ctx.currentBuilder.codeView.setUint32(loc + 1, t0 - loc);
        });
        ctx.unresolveGotoMap.delete(this.label.name);
    }
    this.body.codegen(ctx);
};

GotoStatement.prototype.codegen = function(ctx: CompileContext) {
    const item = ctx.labelMap.get(this.label.name);
    if (item === undefined) {
        const t0 = ctx.currentBuilder.now;
        ctx.build(OpCode.J, 0);
        if (!ctx.unresolveGotoMap.has(this.label.name)) {
            ctx.unresolveGotoMap.set(this.label.name, []);
        }
        ctx.unresolveGotoMap.get(this.label.name)!.push(t0);
    } else {
        const t0 = ctx.currentBuilder.now;
        ctx.build(OpCode.J, item - t0);
    }
};

CaseStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( this.test === null) {
        ctx.switchBuffer.push(ctx.currentBuilder.now);
        this.body.codegen(ctx);
    } else {
        const test = this.test.codegen(ctx);
        if ( test.form !== ExpressionResultType.CONSTANT || !(test.type instanceof IntegerType)) {
            throw new SyntaxError(`case value must be integer or enum`, this);
        }
        ctx.switchBuffer.push(ctx.currentBuilder.now);
        this.body.codegen(ctx);
    }
};

SwitchStatement.prototype.codegen = function(ctx: CompileContext) {
    const caseValues = [];
    const gotoLocs = [];
    const savedSwitchBuffer = ctx.switchBuffer;
    ctx.switchBuffer = [];
    if ( !(this.body instanceof CompoundStatement)) {
        throw new SyntaxError(`switch case body must be CompoundStatement`, this);
    }
    for (const stmt of this.body.body) {
        if ( stmt instanceof CaseStatement ) {
            if ( stmt.test === null) { // default
                caseValues.push("default");
            } else {
                const test = stmt.test.codegen(ctx);
                if ( test.type instanceof IntegerType) {
                    caseValues.push((test.value as Long).toNumber());
                } else {
                    throw new SyntaxError(`switch case value must be integer`, this);
                }
            }
        }
    }
    const cond = this.discriminant.codegen(ctx);
    const condType = extractRealType(cond.type);
    if ( !(condType instanceof IntegerType)) {
        throw new SyntaxError(`the cond of switch must be integer`, this);
    }
    loadIntoStack(ctx, cond);
    const tmpCondVar: ExpressionResult = {
        form: ExpressionResultType.LVALUE_STACK,
        value: ctx.memory.allocStack(4),
        type: PrimitiveTypes.int32,
    };
    popFromStack(ctx, tmpCondVar);
    for (let i = 0; i < caseValues.length; i++) {
        if (caseValues[i] !== "default") {
            loadIntoStack(ctx, tmpCondVar);
            ctx.build(OpCode.PI32, caseValues[i]);
            ctx.build(OpCode.SUB);
            gotoLocs.push(ctx.currentBuilder.now);
            ctx.build(OpCode.JZ, 0);
        } else {
           gotoLocs.push(0);
        }
    }
    const defaultLoc = ctx.currentBuilder.now;
    ctx.build(OpCode.J, 0);
    this.body.codegen(ctx);
    const endLoc = ctx.currentBuilder.now;
    for (let i = 0; i < ctx.switchBuffer.length; i++) {
        const caseLoc = ctx.switchBuffer[i];
        const gotoLoc = gotoLocs[i];
        if ( caseValues[i] === "default" ) {
            ctx.currentBuilder.codeView.setUint32(defaultLoc + 1, caseLoc - defaultLoc);
        } else {
            ctx.currentBuilder.codeView.setUint32(gotoLoc + 1, caseLoc - gotoLoc);
        }
    }
    if ( !caseValues.includes("default")) {
        ctx.currentBuilder.codeView.setUint32(endLoc + 1, defaultLoc - endLoc);

    }
    ctx.switchBuffer = savedSwitchBuffer;
};

ExpressionStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    this.expression.parentIsStmt = true;
    recycleExpressionResult(ctx, this.expression.codegen(ctx));
};

ReturnStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    if ( ctx.currentFunction === null) {
        throw new SyntaxError(`return outside function`, this);
    }
    if (ctx.options.detectStackPollution) {
        ctx.currentFunction.assertPostions.push(ctx.currentBuilder.now);
        ctx.build(OpCode.ASSERTSP, 0);
    }
    if (this.argument != null) {
        const result = this.argument.codegen(ctx);
        loadIntoStack(ctx, result);
        convertTypeOnStack(ctx, ctx.currentFunction.type.returnType,
            extractRealType(result.type));
    } else {
        if (!ctx.currentFunction.type.returnType.equals(PrimitiveTypes.void)) {
            throw new SyntaxError(`illeagl return type`, this);
        }
        ctx.build(OpCode.PUI32, 0);
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
    ctx.build(OpCode.JNZ, l1 - l3);
    const l4 = ctx.currentBuilder!.now;
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
        if ( this.init instanceof Declaration) {
            this.init.codegen(ctx);
        } else {
            recycleExpressionResult(ctx, this.init.codegen(ctx));
        }
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
        l2 = -1;
    }

    this.body.codegen(ctx);

    const l5 = ctx.currentBuilder!.now;
    if (this.update) {
        recycleExpressionResult(ctx, this.update.codegen(ctx));
    }

    ctx.currentNode = this;
    const l3 = ctx.currentBuilder!.now;
    ctx.currentNode = this;
    ctx.build(OpCode.J, l1 - l3);
    const l4 = ctx.currentBuilder!.now;
    if (this.test !== null) {
        ctx.currentBuilder!.codeView.setUint32(l2 + 1, l4 - l2);
    }
    ctx.loopContext.breakPos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l4 - line),
    );
    ctx.loopContext.continuePos.map( (line) =>
        ctx.currentBuilder!.codeView.setUint32(line + 1, l5 - line),
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
