import {
    AssignmentExpression,
    BinaryExpression, CallExpression,
    CastExpression,
    ConditionalExpression, FloatingConstant, Identifier, IntegerConstant, MemberExpression, ParenthesisExpression,
    PostfixExpression, SubscriptExpression,
    TypeName, UnaryExpression,
} from "../common/ast";
import {CompileContext} from "./context";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 18/07/2018
 */

ParenthesisExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.expression.preprocess(ctx);
};

AssignmentExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.left.preprocess(ctx);
};

IntegerConstant.prototype.preprocess = function(ctx: CompileContext): void {
};

FloatingConstant.prototype.preprocess = function(ctx: CompileContext): void {
};

Identifier.prototype.preprocess = function(ctx: CompileContext): void {
};

BinaryExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.left.preprocess(ctx);
    this.right.preprocess(ctx);
};

UnaryExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.location.fileName = ctx.fileName;
    this.operand.preprocess(ctx);
};

CallExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.callee.preprocess(ctx);
};

SubscriptExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.array.preprocess(ctx);
    this.subscript.preprocess(ctx);
};

MemberExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.object.preprocess(ctx);
    this.member.preprocess(ctx);
};

TypeName.prototype.preprocess = function(ctx: CompileContext): void {

};

CastExpression.prototype.preprocess = function(ctx: CompileContext): void {
    return this.typeName.preprocess(ctx);
};

PostfixExpression.prototype.preprocess = function(ctx: CompileContext): void {
    return this.operand.preprocess(ctx);
};

ConditionalExpression.prototype.preprocess = function(ctx: CompileContext): void {
    this.consequent.preprocess(ctx);
    this.alternate.preprocess(ctx);
};
