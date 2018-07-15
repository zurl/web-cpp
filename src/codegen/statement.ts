/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {
    BreakStatement, CaseStatement,
    CompoundStatement, ContinueStatement, Declaration, DoWhileStatement, ExpressionResult,
    ExpressionStatement, ForStatement, GotoStatement,
    IfStatement, LabeledStatement, Node,
    ReturnStatement, SwitchStatement, UnaryExpression, WhileStatement,
} from "../common/ast";
import {SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {FunctionEntity, IntegerType, PointerType, PrimitiveTypes} from "../common/type";
import {WStatement} from "../wasm/node";
import {WBlock, WBr, WBrIf, WDrop, WIfElseBlock, WLoop, WReturn} from "../wasm/statement";
import {CompileContext} from "./context";
import {doConversion, doValueTransform} from "./conversion";

export function recycleExpressionResult(ctx: CompileContext, node: Node, expr: ExpressionResult) {
    if ( expr.expr instanceof FunctionEntity) {
        throw new SyntaxError(`illegal function name`, node);
    }
    if ( expr.isLeft && expr.expr.isPure()) {
        return;
    }
    ctx.submitStatement(new WDrop(expr.expr, node.location));
}

CompoundStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.enterScope(null);
    this.body.map((node) => node.codegen(ctx));
    ctx.exitScope();
};

// LabeledStatement.prototype.codegen = function(ctx: CompileContext) {
//     const item = ctx.labelMap.get(this.label.name);
//     if (item !== undefined) {
//         throw new SyntaxError(`duplicated label ${this.label.name}`, this);
//     }
//     const t0 = ctx.currentBuilder.now;
//     ctx.labelMap.set(this.label.name, t0);
//     const unresolvedLabels = ctx.unresolveGotoMap.get(this.label.name);
//     if (unresolvedLabels !== undefined) {
//         unresolvedLabels.map( (loc) => {
//             ctx.currentBuilder.codeView.setUint32(loc + 1, t0 - loc);
//         });
//         ctx.unresolveGotoMap.delete(this.label.name);
//     }
//     this.body.codegen(ctx);
// };
//
// GotoStatement.prototype.codegen = function(ctx: CompileContext) {
//     const item = ctx.labelMap.get(this.label.name);
//     if (item === undefined) {
//         const t0 = ctx.currentBuilder.now;
//         ctx.build(OpCode.J, 0);
//         if (!ctx.unresolveGotoMap.has(this.label.name)) {
//             ctx.unresolveGotoMap.set(this.label.name, []);
//         }
//         ctx.unresolveGotoMap.get(this.label.name)!.push(t0);
//     } else {
//         const t0 = ctx.currentBuilder.now;
//         ctx.build(OpCode.J, item - t0);
//     }
// };
//
// CaseStatement.prototype.codegen = function(ctx: CompileContext) {
//     if ( this.test === null) {
//         ctx.switchBuffer.push(ctx.currentBuilder.now);
//         this.body.codegen(ctx);
//     } else {
//         const test = this.test.codegen(ctx);
//         if ( test.form !== ExpressionResultType.CONSTANT || !(test.type instanceof IntegerType)) {
//             throw new SyntaxError(`case value must be integer or enum`, this);
//         }
//         ctx.switchBuffer.push(ctx.currentBuilder.now);
//         this.body.codegen(ctx);
//     }
// };
//
// SwitchStatement.prototype.codegen = function(ctx: CompileContext) {
//     const caseValues = [];
//     const gotoLocs = [];
//     const savedSwitchBuffer = ctx.switchBuffer;
//     ctx.switchBuffer = [];
//     if ( !(this.body instanceof CompoundStatement)) {
//         throw new SyntaxError(`switch case body must be CompoundStatement`, this);
//     }
//     for (const stmt of this.body.body) {
//         if ( stmt instanceof CaseStatement ) {
//             if ( stmt.test === null) { // default
//                 caseValues.push("default");
//             } else {
//                 const test = stmt.test.codegen(ctx);
//                 if ( test.type instanceof IntegerType) {
//                     caseValues.push((test.value as Long).toNumber());
//                 } else {
//                     throw new SyntaxError(`switch case value must be integer`, this);
//                 }
//             }
//         }
//     }
//     const cond = this.discriminant.codegen(ctx);
//     const condType = extractRealType(cond.type);
//     if ( !(condType instanceof IntegerType)) {
//         throw new SyntaxError(`the cond of switch must be integer`, this);
//     }
//     loadIntoStack(ctx, cond);
//     const tmpCondVar: ExpressionResult = {
//         form: ExpressionResultType.LVALUE_STACK,
//         value: ctx.memory.allocStack(4),
//         type: PrimitiveTypes.int32,
//     };
//     popFromStack(ctx, tmpCondVar);
//     for (let i = 0; i < caseValues.length; i++) {
//         if (caseValues[i] !== "default") {
//             loadIntoStack(ctx, tmpCondVar);
//             ctx.build(OpCode.PI32, caseValues[i]);
//             ctx.build(OpCode.SUB);
//             gotoLocs.push(ctx.currentBuilder.now);
//             ctx.build(OpCode.JZ, 0);
//         } else {
//            gotoLocs.push(0);
//         }
//     }
//     const defaultLoc = ctx.currentBuilder.now;
//     ctx.build(OpCode.J, 0);
//     this.body.codegen(ctx);
//     const endLoc = ctx.currentBuilder.now;
//     for (let i = 0; i < ctx.switchBuffer.length; i++) {
//         const caseLoc = ctx.switchBuffer[i];
//         const gotoLoc = gotoLocs[i];
//         if ( caseValues[i] === "default" ) {
//             ctx.currentBuilder.codeView.setUint32(defaultLoc + 1, caseLoc - defaultLoc);
//         } else {
//             ctx.currentBuilder.codeView.setUint32(gotoLoc + 1, caseLoc - gotoLoc);
//         }
//     }
//     if ( !caseValues.includes("default")) {
//         ctx.currentBuilder.codeView.setUint32(endLoc + 1, defaultLoc - endLoc);
//
//     }
//     ctx.switchBuffer = savedSwitchBuffer;
// };

ExpressionStatement.prototype.codegen = function(ctx: CompileContext) {
    recycleExpressionResult(ctx, this, this.expression.codegen(ctx));
};

ReturnStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( ctx.currentFunction === null) {
        throw new SyntaxError(`return outside function`, this);
    }
    if (this.argument !== null) {
        if (ctx.currentFunction.type.returnType.equals(PrimitiveTypes.void)) {
            throw new SyntaxError(`return type mismatch`, this);
        }
        const expr = this.argument.codegen(ctx);
        expr.expr = doConversion(ctx.currentFunction.type.returnType, expr, this);
        ctx.submitStatement(new WReturn(expr.expr, this.location));
    } else {
        if (!ctx.currentFunction.type.returnType.equals(PrimitiveTypes.void)) {
            throw new SyntaxError(`return type mismatch`, this);
        }
        ctx.submitStatement(new WReturn(null, this.location));
    }
};

IfStatement.prototype.codegen = function(ctx: CompileContext) {
    const thenStatements: WStatement[] = [];
    const elseStatements: WStatement[] = [];
    const condition = this.test.codegen(ctx);

    condition.expr = doConversion(PrimitiveTypes.int32, condition, this);
    condition.type = PrimitiveTypes.int32;

    const savedContainer = ctx.getStatementContainer();
    ctx.setStatementContainer(thenStatements);
    this.consequent.codegen(ctx);
    if ( this.alternate !== null) {
        ctx.setStatementContainer(elseStatements);
        this.alternate.codegen(ctx);
    }
    ctx.setStatementContainer(savedContainer);

    if ( this.alternate !== null) {
        ctx.submitStatement(new WIfElseBlock(condition.expr, thenStatements,
            elseStatements, this.location));
    } else {
        ctx.submitStatement(new WIfElseBlock(condition.expr, thenStatements,
            null, this.location));
    }
};

WhileStatement.prototype.codegen = function(ctx: CompileContext) {
    const whileStatements: WStatement[] = [];
    const thenStatements: WStatement[] = [];
    const savedContainer = ctx.getStatementContainer();

    // <-- loop -->
    ctx.setStatementContainer(thenStatements);
    const condition = new UnaryExpression(this.location,
        "!", this.test).codegen(ctx);
    condition.expr = doConversion(PrimitiveTypes.int32, condition, this);
    condition.type = PrimitiveTypes.int32;
    ctx.submitStatement(new WBrIf(1, condition.expr, this.location));
    ctx.loopLevel ++;
    this.body.codegen(ctx);
    ctx.loopLevel --;
    ctx.submitStatement(new WBr(0, this.location));
    // <-- loop -->

    // <-- block -->
    ctx.setStatementContainer(whileStatements);
    ctx.submitStatement(new WLoop(thenStatements, this.location));
    // <-- block -->

    ctx.setStatementContainer(savedContainer);
    ctx.submitStatement(new WBlock(whileStatements, this.location));
};

DoWhileStatement.prototype.codegen = function(ctx: CompileContext) {
    ctx.loopLevel ++;
    const thenStatements: WStatement[] = [];
    const savedContainer = ctx.getStatementContainer();
    ctx.setStatementContainer(thenStatements);
    ctx.loopLevel ++;
    this.body.codegen(ctx);
    ctx.loopLevel --;
    const condition =  this.test.codegen(ctx);
    condition.expr = doConversion(PrimitiveTypes.int32, condition, this);
    condition.type = PrimitiveTypes.int32;
    ctx.submitStatement(new WBrIf(0, condition.expr, this.location));
    ctx.setStatementContainer(savedContainer);
    ctx.submitStatement(new WBlock([
        new WLoop(thenStatements, this.location)], this.location));
};

ForStatement.prototype.codegen = function(ctx: CompileContext) {
    if (this.init !== null) {
        if ( this.init instanceof Declaration) {
            this.init.codegen(ctx);
        } else {
            recycleExpressionResult(ctx, this, this.init.codegen(ctx));
        }
    }

    const forStatements: WStatement[] = [];
    const thenStatements: WStatement[] = [];
    const savedContainer = ctx.getStatementContainer();

    // <-- loop -->
    ctx.setStatementContainer(thenStatements);

    if ( this.test === null) {
        ctx.submitStatement(new WBr(1, this.location));
    } else {
        const condition = new UnaryExpression(this.location,
            "!", this.test).codegen(ctx);
        condition.expr = doConversion(PrimitiveTypes.int32, condition, this);
        condition.type = PrimitiveTypes.int32;
        ctx.submitStatement(new WBrIf(1, condition.expr, this.location));
    }

    ctx.loopLevel ++;
    this.body.codegen(ctx);
    ctx.loopLevel --;
    if ( this.update !== null) {
        recycleExpressionResult(ctx, this, this.update.codegen(ctx));
    }
    ctx.submitStatement(new WBr(0, this.location));
    // <-- loop -->

    // <-- block -->
    ctx.setStatementContainer(forStatements);
    ctx.submitStatement(new WLoop(thenStatements, this.location));
    // <-- block -->

    ctx.setStatementContainer(savedContainer);
    ctx.submitStatement(new WBlock(forStatements, this.location));
};

ContinueStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( ctx.loopLevel === 0 ) {
        throw new SyntaxError(`continue is not in while/do-while/for`, this);
    }
    ctx.submitStatement(new WBr(0, this.location));
};

BreakStatement.prototype.codegen = function(ctx: CompileContext) {
    if ( ctx.loopLevel === 0 ) {
        throw new SyntaxError(`break is not in while/do-while/for`, this);
    }
    ctx.submitStatement(new WBr(1, this.location));
};

export function statement() {
    return "";
}
