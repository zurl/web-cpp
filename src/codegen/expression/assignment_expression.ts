import * as Long from "long";
import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType, LeftReferenceType, PointerType} from "../../type/compound_type";
import {CharType, FloatingType, IntegerType} from "../../type/primitive_type";
import {WConst} from "../../wasm";
import {WGetAddress, WMemoryLocation} from "../../wasm/expression";
import {WAddressHolder} from "../address";
import {MemberExpression} from "../class/member_expression";
import {CompileContext} from "../context";
import {doConversion, doReferenceTransform} from "../conversion";
import {CallExpression} from "../function/call_expression";
import {isFunctionExists} from "../overload";
import {doReferenceBinding} from "../reference";
import {BinaryExpression} from "./binary_expression";
import {doVarInit, Expression, ExpressionResult} from "./expression";
import {Identifier} from "./identifier";
import {IntegerConstant} from "./integer_constant";
import {UnaryExpression} from "./unary_expression";

const __charptr = new PointerType(new CharType());
const __ccharptr = new PointerType(new CharType());
__ccharptr.isConst = true;

export class AssignmentExpression extends Expression {
    public operator: string;
    public left: Expression;
    public right: Expression;
    public isInitExpr: boolean;

    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        this.operator = operator;
        this.left = left;
        this.right = right;
        this.isInitExpr = false;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        if (this.operator !== "=") {
            const ope = this.operator.split("=")[0];
            this.operator = "=";
            this.right = new BinaryExpression(this.location,
                ope,
                this.left,
                this.right);
        }

        const leftType = this.left.deduceType(ctx);
        const rightType = this.right.deduceType(ctx);

        if (leftType instanceof ClassType) {
            const fullName = leftType.fullName + "::#=";
            if (isFunctionExists(ctx, fullName, [rightType], leftType)) {
                return new CallExpression(this.location,
                    new MemberExpression(this.location, this.left, false,
                        Identifier.fromString(this.location, "#=")),
                    [
                        this.right]).codegen(ctx);
            } else {
                if (rightType.equals(leftType)) {
                    const len = leftType.length;
                    return new CallExpression(this.location, Identifier.fromString(this.location, "::memcpy"), [
                        new UnaryExpression(this.location, "&", this.left),
                        new UnaryExpression(this.location, "&", this.right),
                        new IntegerConstant(this.location, 10, Long.fromInt(len), len.toString(), null),
                    ]).codegen(ctx);
                } else {
                    const ctorName = leftType.fullName + "::#" + leftType.shortName;
                    const callee = Identifier.fromString(this.location, ctorName);
                    return new CallExpression(this.location, callee, [
                        new UnaryExpression(this.location, "&", this.left),
                        this.right,
                    ]).codegen(ctx);
                }
            }
        }

        let left = this.left.codegen(ctx);
        const right = this.right.codegen(ctx);

        // reference binding
        if (this.isInitExpr && left.type instanceof LeftReferenceType) {
            doReferenceBinding(ctx, left, right, this);
            return left;
        }

        left = doReferenceTransform(ctx, left, this);

        if (!left.isLeft || !(left.expr instanceof WAddressHolder)) {
            throw new SyntaxError(`could not assign to a right value`, this);
        }

        if (left.type instanceof ArrayType) {
            throw new SyntaxError(`unsupport array assignment`, this);
        }

        // 对于初始化表达式 支持常量初始化到data段
        if (this.isInitExpr && this.left instanceof Identifier &&
            left.expr.type === AddressType.MEMORY_DATA) {
            // int & float
            if (right.expr instanceof WConst &&
                (right.type instanceof IntegerType || right.type instanceof FloatingType)) {
                doVarInit(ctx, left.type, right.type, left.expr.place as number,
                    right.expr.constant, this);
                return left;
            }
            // const char
            if (right.expr instanceof WGetAddress &&
                right.expr.form === WMemoryLocation.DATA &&
                right.type.equals(__ccharptr)) {
                if (!(left.type.equals(__charptr)) && !(left.type.equals(__ccharptr))) {
                    throw new SyntaxError(`unsupport init from ${left.type} to ${right.type}`, this);
                }
                ctx.memory.data.setUint32(left.expr.place as number, right.expr.offset, true);
                return left;
            }
        }

        if (!this.isInitExpr && left.type.isConst) {
            throw new SyntaxError(`could not assign to const variable`, this);
        }

        ctx.submitStatement(left.expr.createStore(ctx, left.type,
            doConversion(ctx, left.type, right, this).fold()));

        return left;
    }

    public deduceType(ctx: CompileContext): Type {
        return this.left.deduceType(ctx);
    }

}
