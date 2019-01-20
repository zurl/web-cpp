import {LanguageError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WConst, WType} from "../../wasm";
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
            isLeft: false,
            expr: new WConst(WType.none, "1", this.location),
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
                AddressType.STACK, ctx.memory.allocStack(rightType.length));
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
        const [ptrVarName] = ctx.allocTmpVar(rightType, this);
        const [basePtrVarName] = ctx.allocTmpVar(new PointerType(PrimitiveTypes.int32), this);
        const [sizeVarName] = ctx.allocTmpVar(PrimitiveTypes.int32, this);

        // ptr = ptr
        const assignPtrExpr = new AssignmentExpression(this.location, "=",
            Identifier.fromString(this.location, ptrVarName), this.expr).codegen(ctx);
        recycleExpressionResult(ctx, this, assignPtrExpr);

        const tmpPtrExpr = Identifier.fromString(this.location, ptrVarName).codegen(ctx);
        tmpPtrExpr.type = new PointerType(PrimitiveTypes.int32);

        // basePtr = (int*)ptr - 1
        const basePtrExpr = new AssignmentExpression(this.location, "=",
            Identifier.fromString(this.location, basePtrVarName), new BinaryExpression(
                this.location, "-", new AnonymousExpression(this.location, tmpPtrExpr),
                IntegerConstant.OneConstant,
            )).codegen(ctx);
        recycleExpressionResult(ctx, this, basePtrExpr);

        // size = *basePtr
        const assignSizeExpr = new AssignmentExpression(this.location, "=",
            Identifier.fromString(this.location, sizeVarName), new UnaryExpression(
                this.location, "*", Identifier.fromString(this.location, basePtrVarName),
            )).codegen(ctx);
        recycleExpressionResult(ctx, this, assignSizeExpr);

        if (rightType.elementType instanceof ClassType) {
            // call dtor
            const dtorName = "~" + rightType.elementType.shortName;
            const callee = Identifier.fromString(this.location, dtorName);
            const memExpr = (i: Identifier) => {
                const expr = new MemberExpression(
                    this.location, new BinaryExpression(this.location, "+",
                        Identifier.fromString(this.location, ptrVarName),
                        i), true, callee,
                );
                expr.forceDynamic = true;
                return expr;
            };
            getForLoop(Identifier.fromString(this.location, sizeVarName), (i) => ([
                new ExpressionStatement(this.location,
                    new CallExpression(this.location, memExpr(i), []))]), this).codegen(ctx);

        }

        // free(basePtr)
        new ExpressionStatement(this.location, new CallExpression(
            this.location, Identifier.fromString(this.location, "::free"),
            [Identifier.fromString(this.location, basePtrVarName)],
        )).codegen(ctx);
    }
}
