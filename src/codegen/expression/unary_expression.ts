import {InternalError, SyntaxError, TypeError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType, LeftReferenceType, PointerType, ReferenceType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {I32Unary, WConst, WType, WUnaryOperation} from "../../wasm";
import {WAddressHolder} from "../address";
import {MemberExpression} from "../class/member_expression";
import {CompileContext} from "../context";
import {doConversion, doReferenceTransform, doTypeTransfrom, doValueTransform} from "../conversion";
import {CallExpression} from "../function/call_expression";
import {AssignmentExpression} from "./assignment_expression";
import {BinaryExpression} from "./binary_expression";
import {Expression, ExpressionResult} from "./expression";
import {Identifier} from "./identifier";
import {IntegerConstant} from "./integer_constant";
import {SubscriptExpression} from "./subscript_expression";

export class UnaryExpression extends Expression {
    public operator: string; // ++, --, sizeof, *, +, -, !, ~
    public operand: Expression;

    constructor(location: SourceLocation, operator: string, operand: Expression) {
        super(location);
        this.operator = operator;
        this.operand = operand;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        if (this.operator === "sizeof") {
            return {
                type: PrimitiveTypes.uint32,
                expr: new WConst(WType.u32,
                    this.operand.deduceType(ctx).length.toString(),
                    this.location,
                ),
                isLeft: false,
            };
        }

        const leftType = this.operand.deduceType(ctx);

        if (leftType instanceof ClassType) {
            const item = ctx.scopeManager.lookup(
                leftType.fullName + "::#" + this.operator,
            );
            if (item != null) {
                return new CallExpression(this.location,
                    new MemberExpression(this.location, this.operand, false,
                        Identifier.fromString(this.location, "#" + this.operator)),
                    []).codegen(ctx);
            }
        }

        if (this.operator === "++" || this.operator === "--") {
            return new AssignmentExpression(this.location,
                "=",
                this.operand,
                new BinaryExpression(this.location,
                    this.operator.charAt(0),
                    this.operand,
                    IntegerConstant.OneConstant))
                .codegen(ctx);
        }
        if (this.operator === "&") {
            if (this.operand instanceof SubscriptExpression) {
                return new BinaryExpression(this.location, "+",
                    this.operand.array, this.operand.subscript).codegen(ctx);
            } else if (this.operand instanceof UnaryExpression && this.operand.operator === "*") {
                return this.operand.operand.codegen(ctx);
            }
        }
        let expr = this.operand.codegen(ctx);
        if (this.operator === "*") {
            if (expr.type instanceof ReferenceType) {
                expr = doReferenceTransform(ctx, expr, this);
            }
            if (expr.type instanceof PointerType) {
                return {
                    isLeft: true,
                    type: new LeftReferenceType(expr.type.elementType),
                    expr: expr.expr,
                };
            } else {
                throw new SyntaxError(`you could not apply * on ${expr.type.toString()} `, this);
            }
        } else if (this.operator === "&") {
            if (!expr.isLeft || !(expr.expr instanceof WAddressHolder)) {
                throw new SyntaxError(`you could not get address of a right value `, this);
            }
            if (expr.type instanceof ArrayType) {
                expr.type = expr.type.elementType;
            }
            return {
                isLeft: false,
                type: new PointerType(expr.type),
                expr: expr.expr.createLoadAddress(ctx),
            };
        } else if (this.operator === "+") {
            return doValueTransform(ctx, this.operand.codegen(ctx), this);
        } else if (this.operator === "-") {
            return new BinaryExpression(this.location, "-",
                IntegerConstant.ZeroConstant,
                this.operand,
            ).codegen(ctx);
        } else if (this.operator === "!") {
            const value = doConversion(ctx, PrimitiveTypes.int32, this.operand.codegen(ctx), this);
            return {
                type: PrimitiveTypes.int32,
                isLeft: false,
                expr: new WUnaryOperation(I32Unary.eqz, value, this.location),
            };
        } else if (this.operator === "~") {
            return new BinaryExpression(this.location, "^",
                IntegerConstant.NegOneConstant,
                this.operand,
            ).codegen(ctx);
        } else {
            throw new InternalError(`no_impl at unary ope=${this.operator}`);
        }
    }

    public deduceType(ctx: CompileContext): Type {
        if ( this.operator === "sizeof") {
            return PrimitiveTypes.uint32;
        } else if ( this.operator === "++" || this.operator === "--") {
            return new BinaryExpression(this.location,
                this.operator.charAt(0),
                this.operand,
                IntegerConstant.OneConstant)
                .deduceType(ctx);
        }

        const leftType = this.operand.deduceType(ctx);

        if (leftType instanceof ClassType) {
            const item = ctx.scopeManager.lookup(
                leftType.fullName + "::#" + this.operator,
            );
            if (item != null) {
                return new CallExpression(this.location,
                    new MemberExpression(this.location, this.operand, false,
                        Identifier.fromString(this.location, "#" + this.operator)),
                    []).deduceType(ctx);
            }
        }

        const itemType = doTypeTransfrom(leftType);
        if (this.operator === "*") {
            if (itemType instanceof PointerType || itemType instanceof ArrayType) {
                return itemType.elementType;
            } else if (itemType instanceof LeftReferenceType
                && (itemType.elementType instanceof PointerType
                    || itemType.elementType instanceof ArrayType)) {
                return itemType.elementType.elementType;
            } else {
                throw new TypeError(`could not apply * on ${itemType.toString()}`, this);
            }
        } else if (this.operator === "&") {
            return new PointerType(itemType);
        } else if (this.operator === "!" || this.operator === "~") {
            return PrimitiveTypes.int32;
        } else if (this.operator === "+" || this.operator === "-") {
            return this.operand.deduceType(ctx);
        } else {
            throw new InternalError(`no imple at UnaryExpression().deduce`);
        }
    }

}
