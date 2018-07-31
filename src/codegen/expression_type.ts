import {
    AssignmentExpression,
    BinaryExpression,
    CallExpression,
    CastExpression, CharacterConstant,
    ConditionalExpression,
    ConstructorCallExpression,
    FloatingConstant,
    Identifier,
    IntegerConstant,
    MemberExpression,
    ParenthesisExpression,
    PostfixExpression,
    StringLiteral,
    SubscriptExpression,
    TypeName,
    UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError, TypeError} from "../common/error";
import {
    ArithmeticType, ArrayType, ClassType, FloatingType, FunctionEntity,
    FunctionType, Int64Type,
    IntegerType,
    LeftReferenceType,
    PointerType,
    PrimitiveTypes,
    Type, UnresolveFunctionOverloadType, UnsignedInt64Type, UnsignedIntegerType, Variable,
} from "../common/type";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doTypeTransfrom} from "./conversion";
import {doFunctionOverloadResolution} from "./cpp/overload";
import {parseAbstractDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {FunctionLookUpResult} from "./scope";
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

CharacterConstant.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.codegen(ctx).type;
};

FloatingConstant.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.codegen(ctx).type;
};

StringLiteral.prototype.deduceType = function(ctx: CompileContext): Type {
    return this.codegen(ctx).type;
};

Identifier.prototype.deduceType = function(ctx: CompileContext): Type {
    const item = this.codegen(ctx);
    if ( item.expr instanceof FunctionLookUpResult ) {
        return new UnresolveFunctionOverloadType(item.expr);
    } else {
        return item.type;
    }
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
    const left = doTypeTransfrom(this.left.deduceType(ctx));
    const right = doTypeTransfrom(this.right.deduceType(ctx));

    if (left instanceof ClassType) {
        return new CallExpression(this.location,
            new MemberExpression(this.location, this.left, false,
                new Identifier(this.location, "#" + this.operator)),
            [this.right]).deduceType(ctx);
    }

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
    const itemType = doTypeTransfrom(this.operand.deduceType(ctx));
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
};

CallExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    const calleeType = this.callee.deduceType(ctx);

    if (calleeType instanceof PointerType && calleeType.elementType instanceof FunctionType) {
        return calleeType.elementType.returnType;
    }

    if (!(calleeType instanceof UnresolveFunctionOverloadType)) {
        throw new TypeError(`the callee is not function`, this);
    }
    const lookUpResult = calleeType.functionLookupResult;

    let entity: FunctionEntity | null = lookUpResult.functions[0];

    if ( ctx.isCpp() ) {
        entity = doFunctionOverloadResolution(lookUpResult, this.arguments.map((x) => x.deduceType(ctx)), this);
    }

    if (entity === null ) {
        throw new SyntaxError(`no matching function for ${lookUpResult.functions[0].name}`, this);
    }

    return entity.type.returnType;
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
    const item = ctx.scopeManager.lookupFullName(rawType.fullName + "::" + this.member.name);

    if ( item !== null ) {
        if ( item instanceof Type ) {
            throw new SyntaxError(`illegal type member expression`, this);
        } else if (item instanceof Variable) {
            // static field
            return item.type;
        } else {
            item.instanceType = rawType;
            return new UnresolveFunctionOverloadType(item);
        }
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
    const leftType = doTypeTransfrom(this.consequent.deduceType(ctx));
    const rightType = doTypeTransfrom(this.alternate.deduceType(ctx));
    if (leftType instanceof ArithmeticType && rightType instanceof ArithmeticType) {
        return arithmeticDeduce(leftType, rightType);
    } else if (leftType.equals(rightType)) {
        return leftType;
    } else {
        throw new SyntaxError(`the type between conditional expression is not same`, this);
    }
};

ConstructorCallExpression.prototype.deduceType = function(ctx: CompileContext): Type {
    const name = this.name.identifier.name;
    const item = ctx.scopeManager.lookupAnyName(name);
    if ( !(item instanceof ClassType) ) {
        throw new SyntaxError(`constructor call must be class type`, this);
    }
    return item;
};
export function expression_type() {
    return "";
}
