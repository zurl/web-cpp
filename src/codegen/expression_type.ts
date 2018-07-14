import {
    AssignmentExpression, BinaryExpression, CallExpression, CastExpression, ConditionalExpression,
    FloatingConstant,
    Identifier,
    IntegerConstant, MemberExpression,
    ParenthesisExpression, PostfixExpression, SourceLocation, SubscriptExpression, TypeName, UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError, TypeError} from "../common/error";
import {
    ArithmeticType, ArrayType, ClassType, extractRealType, FloatingType,
    FloatType,
    FunctionType, Int64Type,
    IntegerType,
    LeftReferenceType,
    PointerType,
    PrimitiveTypes,
    Type, UnsignedInt64Type, UnsignedIntegerType,
} from "../common/type";
import {CompileContext} from "./context";
import {parseAbstractDeclarator, parseTypeFromSpecifiers} from "./declaration";
/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 23/06/2018
 */

ParenthesisExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.expression.deduceType(ctx);
};

AssignmentExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.left.deduceType(ctx);
};

IntegerConstant.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.codegen(ctx).type;
};

FloatingConstant.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.codegen(ctx).type;
};

Identifier.prototype.deduceType = function(ctx: CompileContext): Type {
    const item = ctx.currentScope.get(this.name);
    if (item === null) {
        throw new SyntaxError(`Unresolve Name ${this.name}`, this);
    }
    if (item instanceof Type) {
        throw new SyntaxError(`${this.name} expect to be variable, but it is a type :)`, this);
    }
    return item.type;
};

function arithmeticDeduce(left: ArithmeticType, right: ArithmeticType): ArithmeticType {
    if (left instanceof FloatingType || right instanceof FloatingType) {
        return PrimitiveTypes.double;
    }
    if (left instanceof UnsignedInt64Type || right instanceof UnsignedInt64Type) {
        return PrimitiveTypes.uint64;
    }
    if (left instanceof Int64Type || right instanceof Int64Type) {
        return PrimitiveTypes.int64;
    }
    if (left instanceof UnsignedIntegerType || right instanceof UnsignedIntegerType) {
        return PrimitiveTypes.uint32;
    }
    return PrimitiveTypes.int32;
}

BinaryExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    const left = extractRealType(this.left.deduceType(ctx));
    const right = extractRealType(this.right.deduceType(ctx));
    if ("+-*%/".includes(this.operator)) {
        if (left instanceof ArithmeticType && right instanceof ArithmeticType) {
            return arithmeticDeduce(left, right);
        } else if (left instanceof PointerType || right instanceof PointerType) {
            if (left instanceof PointerType && right instanceof PointerType) {
                throw new TypeError(`could not apply ope on two pointer`, this);
            }
            if (left instanceof PointerType) {
                if (!(right instanceof IntegerType)) {
                    throw new TypeError(`could not apply ${right.toString()} to pointer`, this);
                }
                return left;
            } else if (right instanceof PointerType) {
                if (!(left instanceof IntegerType)) {
                    throw new TypeError(`could not apply ${left.toString()} to pointer`, this);
                }
                if (this.operator === "-") {
                    throw new TypeError(`could - a pointer`, this);
                }
                return right;
            } else {
                throw new TypeError(`bad operator on pointer`, this);
            }
        } else {
            throw new TypeError(`could not apply ${this.operator} on ${left.toString()} and ${right.toString()}`, this);
        }
    } else if ([">=", "<=", ">", "<", "==", "!="].includes(this.operator)) {
        if (left instanceof ArithmeticType && right instanceof ArithmeticType) {
            return PrimitiveTypes.bool;
        }
        if (left instanceof PointerType && right instanceof PointerType) {
            return PrimitiveTypes.bool;
        }
        throw new TypeError(`unsupport relation compute`, this);
    } else if (["&&", "||"].includes(this.operator)) {
        return PrimitiveTypes.bool;
    } else if (["&", "|", "^", ">>", "<<"].includes(this.operator)) {
        if ( !( left instanceof IntegerType && right instanceof IntegerType)) {
            throw new TypeError(`binary operator could only be applied on integer`, this);
        }
        return PrimitiveTypes.int32;
    } else if (this.operator === ",") {
        return this.right.deduceType(ctx);
    }
    throw new InternalError(`no impl at BinaryExpression()`);
};

UnaryExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    if ( this.operator === "sizeof") {
        return PrimitiveTypes.uint32;
    } else if ( this.operator === "++" || this.operator === "--") {
        return new BinaryExpression(this.location,
            this.operator.charAt(0),
            this.operand,
            IntegerConstant.getOne())
            .deduceType(ctx);
    }
    const itemType = this.operand.deduceType(ctx);
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
    } else {
        throw new InternalError(`no imple at UnaryExpression().deduce`);
    }
};

CallExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    const calleeType = this.callee.deduceType(ctx);
    if (!(calleeType instanceof FunctionType)) {
        throw new TypeError(`the callee is not function`, this);
    }
    return calleeType.returnType;
};

SubscriptExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    return new UnaryExpression(
        this.location,
        "*",
        new BinaryExpression(
            this.location,
            "+",
            this.array,
            this.subscript,
        ),
    ).deduceType(ctx);
};

MemberExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    const left = this.pointed ?
        new UnaryExpression(this.location, "*", this.object).deduceType(ctx)
        : this.object.deduceType(ctx);
    let rawType = left;
    if ( rawType instanceof LeftReferenceType) {
        rawType = rawType.elementType;
    }
    if ( !(rawType instanceof ClassType)) {
        throw new SyntaxError(`only struct/class could be get member`, this);
    }
    const field = rawType.fieldMap.get(this.member.name);
    if ( !field ) {
        throw new SyntaxError(`property ${this.member.name} does not appear on ${rawType.name}`, this);
    }
    if ( left instanceof LeftReferenceType) {
        return new LeftReferenceType(field.type);
    } else {
        return field.type;
    }
};

TypeName.prototype.deduceType = function(ctx: CompileContext): Type {
    let type = parseTypeFromSpecifiers(ctx, this.specifierQualifiers, this);
    if ( this.declarator) {
        type = parseAbstractDeclarator(ctx, this.declarator, type);
    }
    return type;
};

CastExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.typeName.deduceType(ctx);
};

PostfixExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.operand.deduceType(ctx);
};

ConditionalExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    const leftType = extractRealType(this.consequent.deduceType(ctx));
    const rightType = extractRealType(this.alternate.deduceType(ctx));
    if (leftType instanceof ArithmeticType && rightType instanceof ArithmeticType) {
        return arithmeticDeduce(leftType, rightType);
    } else if (leftType.equals(rightType)) {
        return leftType;
    } else {
        throw new SyntaxError(`the type between conditional expression is not same`, this);
    }
};

export function expression_type() {
    const a = 1;
    return "";
}
