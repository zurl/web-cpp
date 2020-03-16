import {LanguageError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {AccessControl, Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WEmptyExpression} from "../../wasm";
import {CompileContext} from "../context";
import {AnonymousExpression} from "../expression/anonymous_expression";
import {AssignmentExpression} from "../expression/assignment_expression";
import {BinaryExpression} from "../expression/binary_expression";
import {Expression, ExpressionResult, recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {IntegerConstant} from "../expression/integer_constant";
import {UnaryExpression} from "../expression/unary_expression";
import {CallExpression} from "../function/call_expression";
import {ExpressionStatement} from "../statement/expression_statement";
import {getForLoop} from "../statement/for_statement";
import {MemberExpression} from "./member_expression";

export class DeleteExpression extends Expression {
    public expr: Expression;
    public isArrayDelete: boolean;

    constructor(location: SourceLocation, expr: Expression, isArrayDelete: boolean) {
        super(location);
        this.expr = expr;
        this.isArrayDelete = isArrayDelete;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        if (!ctx.isCpp()) {
            throw new LanguageError(`delete is only support in c++`, this);
        }
        if (this.isArrayDelete) {
            this.deleteArray(ctx);
        } else {
            this.deleteObject(ctx);
        }
        return {
            type: PrimitiveTypes.void,
            expr: WEmptyExpression.instance,
        };
    }

    public deduceType(ctx: CompileContext): Type {
        return PrimitiveTypes.void;
    }

    private deleteObject(ctx: CompileContext): void {
        const rightType = this.expr.deduceType(ctx);
        if (!(rightType instanceof PointerType)) {
            throw new SyntaxError(`you can only delete pointer, instead of ${rightType.toString()}`, this);
        }
        if (rightType.elementType instanceof ClassType) {
            const tmpVarName = ctx.scopeManager.allocTmpVarName();
            const tmpVar = new Variable(tmpVarName, tmpVarName, this.location.fileName, rightType,
                AddressType.STACK, ctx.memory.allocStack(rightType.length), AccessControl.Public);
            ctx.scopeManager.define(tmpVarName, tmpVar, this);

            new AssignmentExpression(this.location, "=",
                Identifier.fromString(this.location, tmpVarName), this.expr).codegen(ctx);

            const memExpr =
                new MemberExpression(this.location, Identifier.fromString(this.location, tmpVarName),
                    true, Identifier.fromString(this.location, "~" + rightType.elementType.shortName));

            memExpr.forceDynamic = true;

            new ExpressionStatement(this.location, new CallExpression(this.location, memExpr,
                [])).codegen(ctx);

            new ExpressionStatement(this.location, new CallExpression(this.location,
                Identifier.fromString(this.location, "::free"), [
                    Identifier.fromString(this.location, tmpVarName),
                ])).codegen(ctx);
        } else {
            new ExpressionStatement(this.location, new CallExpression(
                this.location, Identifier.fromString(this.location, "::free"),
                [this.expr],
            )).codegen(ctx);
        }
    }

    private deleteArray(ctx: CompileContext): void {
        const rightType = this.expr.deduceType(ctx);
        if (!(rightType instanceof PointerType)) {
            throw new SyntaxError(`you can only delete pointer, instead of ${rightType.toString()}`, this);
        }
        const ptrVar = Identifier.allocTmpVar(ctx, rightType, this);
        const baseVarPtr = Identifier.allocTmpVar(ctx, new PointerType(PrimitiveTypes.int32), this);
        const sizeVar = Identifier.allocTmpVar(ctx, PrimitiveTypes.int32, this);

        // ptr = ptr
        const assignPtrExpr = new AssignmentExpression(this.location, "=",
            ptrVar, this.expr).codegen(ctx);
        recycleExpressionResult(ctx, assignPtrExpr);

        const tmpPtrExpr = ptrVar.codegen(ctx);
        tmpPtrExpr.type = new PointerType(PrimitiveTypes.int32);

        // basePtr = (int*)ptr - 1
        const basePtrExpr = new AssignmentExpression(this.location, "=",
            baseVarPtr, new BinaryExpression(
                this.location, "-", new AnonymousExpression(this.location, tmpPtrExpr),
                IntegerConstant.OneConstant,
            )).codegen(ctx);
        recycleExpressionResult(ctx, basePtrExpr);

        // size = *basePtr
        const assignSizeExpr = new AssignmentExpression(this.location, "=",
            sizeVar, new UnaryExpression(
                this.location, "*", baseVarPtr,
            )).codegen(ctx);
        recycleExpressionResult(ctx, assignSizeExpr);

        if (rightType.elementType instanceof ClassType) {
            // call dtor
            const dtorName = "~" + rightType.elementType.shortName;
            const callee = Identifier.fromString(this.location, dtorName);
            const memExpr = (i: Identifier) => {
                const expr = new MemberExpression(
                    this.location, new BinaryExpression(this.location, "+",
                        ptrVar,
                        i), true, callee,
                );
                expr.forceDynamic = true;
                return expr;
            };
            getForLoop(sizeVar, (i) => ([
                new ExpressionStatement(this.location,
                    new CallExpression(this.location, memExpr(i), []))]), this).codegen(ctx);

        }

        // free(basePtr)
        new ExpressionStatement(this.location, new CallExpression(
            this.location, Identifier.fromString(this.location, "::free"),
            [baseVarPtr],
        )).codegen(ctx);
    }
}
