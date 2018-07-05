/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 17/06/2018
 */
import * as Long from "long";
import {
    AssignmentExpression,
    BinaryExpression, CharacterConstant,
    ExpressionResult,
    ExpressionResultType,
    FloatingConstant,
    Identifier,
    IntegerConstant,
    ParenthesisExpression, StringLiteral,
    SubscriptExpression, UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {
    ArithmeticType,
    ArrayType, CharType,
    ClassType,
    DoubleType,
    extractRealType,
    FloatingType,
    FloatType, Int16Type, Int32Type,
    Int64Type,
    IntegerType,
    LeftReferenceType,
    PointerType,
    PrimitiveTypes,
    QualifiedType,
    Type,
    UnsignedCharType,
    UnsignedInt16Type,
    UnsignedInt32Type,
    UnsignedInt64Type,
    UnsignedIntegerType, VariableStorageType,
} from "../common/type";
import {FunctionEntity} from "../common/type";
import {CompileContext} from "./context";
import {convertTypeOnStack, loadAddress, loadIntoStack, loadReference, popFromStack} from "./stack";

ParenthesisExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return this.expression.codegen(ctx);
};

AssignmentExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    if (this.operator !== "=") {
        const ope = this.operator.split("=")[0];
        this.operator = "=";
        this.right = new BinaryExpression(this.location,
            ope,
            this.left,
            this.right);
    }
    // C++ 17 规定RHS优先计算
    const right = this.right.codegen(ctx);

    // 对于初始化表达式 支持常量初始化到data段
    if (this.isInitExpr
        && this.left instanceof Identifier
        && right.form === ExpressionResultType.CONSTANT
        && (right.type instanceof IntegerType ||
            right.type instanceof FloatingType ||
            right.type.equals(PrimitiveTypes.__ccharptr))) {
        const item = this.left.codegen(ctx);
        if (item.form === ExpressionResultType.LVALUE_MEMORY_DATA) {
            return doVarInit(ctx, item, right);
        }
    }

    // C 语言 隐式类型转换包括两个部分
    // 1.隐式转换语法
    //  1.1 赋值转换
    //  1.2 通常算术转换
    // 2.隐式转换语义
    //  1.1 值变换
    //  1.2 兼容语义

    // 赋值隐式类型转换
    const leftRawType = this.left.deduceType(ctx);
    if ( leftRawType instanceof QualifiedType && leftRawType.isConst ) {
        throw new SyntaxError(`cannot assign to a const variable`, this);
    }
    const leftType = extractRealType(leftRawType);
    const rightType = extractRealType(right.type);
    if (rightType instanceof ClassType) {
        throw new SyntaxError(`unsupport operator overload`, this);
    }
    loadIntoStack(ctx, right);
    // 在赋值运算符中，右运算数的值被转换成左运算数的无限定类型
    convertTypeOnStack(ctx, leftType, rightType, this);
    const left = this.left.codegen(ctx);
    if (leftType instanceof ClassType) {
        throw new SyntaxError(`unsupport operator overload`, this);
    }
    popFromStack(ctx, left);
    return {
        type: leftType,
        form: left.form,
        value: left.value,
    };
};

IntegerConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    let type = PrimitiveTypes.int32;
    if (this.suffix) {
        if (this.suffix.toUpperCase().indexOf("U") !== -1) {
            if (this.suffix.toUpperCase().indexOf("LL") !== -1) {
                type = PrimitiveTypes.uint64;
            } else {
                type = PrimitiveTypes.uint32;
            }
        } else {
            if (this.suffix.toUpperCase().indexOf("LL") !== -1) {
                type = PrimitiveTypes.int64;
            } else {
                type = PrimitiveTypes.int32;
            }
        }
    }
    return {
        type,
        form: ExpressionResultType.CONSTANT,
        value: this.value,
    };
};

FloatingConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    let type = PrimitiveTypes.double;
    if (this.suffix && this.suffix.toUpperCase() === "f") {
        type = PrimitiveTypes.float;
    }
    return {
        type,
        form: ExpressionResultType.CONSTANT,
        value: this.value,
    };
};

StringLiteral.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    return {
        type: PrimitiveTypes.__ccharptr,
        form: ExpressionResultType.CONSTANT,
        value: ctx.memory.allocString(this.value),
    };
};
CharacterConstant.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    return {
        type: PrimitiveTypes.char,
        form: ExpressionResultType.CONSTANT,
        value: Long.fromInt(this.value.charCodeAt(0)),
    };
};

Identifier.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    const item = ctx.currentScope.get(this.name);
    if (item === null) {
        throw new SyntaxError(`Unresolve Name ${this.name}`, this);
    }
    if (item instanceof Type) {
        throw new SyntaxError(`${this.name} expect to be variable, but it is a type :)`, this);
    }
    if (item instanceof FunctionEntity) {
        return {
            type: item.type,
            form: ExpressionResultType.RVALUE,
            value: item,
            isConst: true,
        };
    }

    let type = item.type, isConst = false;
    while (type instanceof QualifiedType) {
        if (type.isConst) {
            isConst = true;
        }
        type = type.elementType;
    }

    if (item.storageType === VariableStorageType.STACK) {
        return {
            type,
            form: ExpressionResultType.LVALUE_STACK,
            value: item.location,
            isConst,
        };
    } else if (item.storageType === VariableStorageType.MEMORY_DATA) {
        return {
            type,
            form: ExpressionResultType.LVALUE_MEMORY_DATA,
            value: item.location,
            isConst,
        };
    } else if (item.storageType === VariableStorageType.MEMORY_BSS) {
        return {
            type,
            form: ExpressionResultType.LVALUE_MEMORY_BSS,
            value: item.location,
            isConst,
        };
    } else if (item.storageType === VariableStorageType.MEMORY_EXTERN) {
        return {
            type,
            form: ExpressionResultType.LVALUE_MEMORY_EXTERN,
            value: item.location,
            isConst,
        };
    } else {
        throw new InternalError(`unknown error at item.storageType`);
    }
};

// Require: left.type and right.type instanceof ArithmeticType
function doConstantCompute(left: ExpressionResult, right: ExpressionResult, ope: string): ExpressionResult {
    if (left.type instanceof FloatingType || right.type instanceof FloatingType) {
        let lhs = left.value, rhs = right.value, type = PrimitiveTypes.float;
        if (left.type instanceof IntegerType) {
            lhs = (left.value as Long).toNumber();
        }
        if (right.type instanceof IntegerType) {
            rhs = (right.value as Long).toNumber();
        }
        if (left.type instanceof DoubleType || right.type instanceof DoubleType) {
            type = PrimitiveTypes.double;
        }
        return {
            type,
            form: ExpressionResultType.CONSTANT,
            value: eval(`${lhs}${ope}${rhs}`),
        };
    } else {
        const lhs = left.value as Long, rhs = right.value as Long;
        let type = PrimitiveTypes.int32, result = lhs;
        if (left.type instanceof UnsignedInt64Type || right.type instanceof UnsignedInt64Type) {
            type = PrimitiveTypes.uint64;
        }
        if (left.type instanceof Int64Type || right.type instanceof Int64Type) {
            type = PrimitiveTypes.int64;
        }
        if (ope === "+") {
            result = lhs.add(rhs);
        } else if (ope === "-") {
            result = lhs.sub(rhs);
        } else if (ope === "*") {
            result = lhs.mul(rhs);
        } else if (ope === "/") {
            result = lhs.div(rhs);
        } else if (ope === "%") {
            result = lhs.mod(rhs);
        }
        return {
            type,
            form: ExpressionResultType.CONSTANT,
            value: result,
        };
    }
}

const ArithmeticOpTable = new Map<string, OpCode[]>([
    ["+", [OpCode.ADD, OpCode.ADDU, OpCode.ADDF]],
    ["-", [OpCode.SUB, OpCode.SUBU, OpCode.ADDF]],
    ["*", [OpCode.MUL, OpCode.NOP, OpCode.ADDF]],
    ["/", [OpCode.DIV, OpCode.NOP, OpCode.ADDF]],
    ["%", [OpCode.MOD, OpCode.NOP, OpCode.ADDF]],
]);

const RelationOpTable = new Map<string, OpCode>([
    [">", OpCode.GT0],
    ["<", OpCode.LT0],
    [">=", OpCode.GTE0],
    ["<=", OpCode.LTE0],
    ["==", OpCode.EQ0],
    ["!=", OpCode.NEQ0],
]);

function genArithmeticExpression(expr: BinaryExpression, ctx: CompileContext,
                                 left: ExpressionResult, right: ExpressionResult): ExpressionResult {
    const leftType = extractRealType(left.type);
    const rightType = extractRealType(right.type);
    if (leftType instanceof ArithmeticType && rightType instanceof ArithmeticType) {
        if (left.form === ExpressionResultType.CONSTANT && right.form === ExpressionResultType.CONSTANT) {
            return doConstantCompute(left, right, expr.operator);
        } else {
            let type = PrimitiveTypes.int32;
            loadIntoStack(ctx, left);
            if (leftType instanceof FloatType) {
                ctx.build(OpCode.F2D);
            }
            if (leftType instanceof IntegerType && rightType instanceof FloatingType) {
                ctx.build(OpCode.I2D);
            }
            loadIntoStack(ctx, right);
            if (leftType instanceof FloatType) {
                ctx.build(OpCode.F2D);
            }
            if (rightType instanceof IntegerType && leftType instanceof FloatingType) {
                ctx.build(OpCode.I2D);
            }
            if ("+-*/%".includes(expr.operator)) {
                if (leftType instanceof FloatingType || rightType instanceof FloatingType) {
                    ctx.build((ArithmeticOpTable.get(expr.operator)!)[2]);
                    type = PrimitiveTypes.double;
                } else if (leftType instanceof UnsignedIntegerType || rightType instanceof UnsignedIntegerType) {
                    ctx.build((ArithmeticOpTable.get(expr.operator)!)[1]);
                    type = PrimitiveTypes.uint32;
                } else {
                    ctx.build((ArithmeticOpTable.get(expr.operator)!)[0]);
                    type = PrimitiveTypes.int32;
                }
            } else if ([">", "<", ">=", "<=", "==", "!="].includes(expr.operator)) {
                if (leftType instanceof FloatingType || rightType instanceof FloatingType) {
                    ctx.build(OpCode.SUBF);
                    ctx.build(OpCode.D2I);
                } else if (leftType instanceof UnsignedIntegerType || rightType instanceof UnsignedIntegerType) {
                    ctx.build(OpCode.SUBU);
                    ctx.build(OpCode.U2I);
                } else {
                    ctx.build(OpCode.SUB);
                }
                ctx.build(RelationOpTable.get(expr.operator)!);
                type = PrimitiveTypes.bool;
            } else {
                throw new InternalError("no_impl at arith ope");
            }
            return {
                form: ExpressionResultType.RVALUE,
                type,
                value: 0,
            };
        }
    } else {
        throw new SyntaxError(`the operation ${expr.operator} could not be applied on `
            + `${left.type.toString()} and ${right.type.toString()}`, expr);
    }
}

function genPointerCompute(ctx: CompileContext, ope: string,
                           left: ExpressionResult, right: ExpressionResult)
    : ExpressionResult {
    const leftType = extractRealType(left.type);
    const rightType = extractRealType(right.type);
    if (leftType instanceof PointerType && rightType instanceof PointerType) {
        throw new SyntaxError(`unsupport operation between`, ctx.currentNode!);
    } else {
        loadIntoStack(ctx, left);
        loadIntoStack(ctx, right);
        if (ope === "+") {
            ctx.build(OpCode.ADDU);
        } else if (ope === "-") {
            ctx.build(OpCode.SUBU);
        } else {
            throw new InternalError(`doPointerCompute()`);
        }
        return {
            form: ExpressionResultType.RVALUE,
            type: left.type,
            value: 0,
        };
    }
}

BinaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    // 救救刘人语小姐姐
    const left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);
    const leftType = extractRealType(left.type);
    const rightType = extractRealType(right.type);
    // left type contains
    // arith, pointer, [class, union, enum](dead), function(dead), [void, nullptr](dead)
    ctx.currentNode = this;
    if (leftType instanceof ClassType || leftType instanceof ClassType) {
        throw new InternalError(`unsupport operator overload`);
    }
    if (leftType instanceof PointerType || rightType instanceof PointerType) {
        if ("+-".indexOf(this.operator) !== -1) {
            return genPointerCompute(ctx, this.operator, left, right);
        } else {
            throw new SyntaxError(`unsupport ope between ${left.type.toString()} an ${right.type.toString()}`, this);
        }
    } else if (["+", "-", "*", "/", "%", "<", ">", ">=", "<=", "==", "!="].includes(this.operator)) {
        return genArithmeticExpression(this, ctx, left, right);
    } else {
        throw new InternalError(`unsupport operator`);
    }
};

UnaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const expr = this.operand.codegen(ctx);
    ctx.currentNode = this;
    if (this.operator === "*") {
        if (expr.type instanceof PointerType || expr.type instanceof ArrayType) {
            //
            // * lval value表示指针的地址     => LADDR, LM32
            // * rval 指针在stop             => LM32
            if (expr.form !== ExpressionResultType.RVALUE) {
                loadAddress(ctx, expr);
                ctx.build(OpCode.LM32);
            }
            return {
                form: ExpressionResultType.RVALUE, // pointer的本体在栈顶
                type: new LeftReferenceType(expr.type.elementType),
                value: 0,
            };
        } else if (expr.type instanceof LeftReferenceType
            && (expr.type.elementType instanceof PointerType
                || expr.type.elementType instanceof ArrayType)) {
            // 这是一个pointer的引用，所以pointer本身的地址在rvalue里
            //
            loadReference(ctx, expr);
            return {
                form: ExpressionResultType.RVALUE,
                type: new LeftReferenceType(expr.type.elementType.elementType),
                value: 0,
            };
        } else {
            throw new SyntaxError(`you could not apply * on ${expr.type.toString()} `, this);
        }
    } else if (this.operator === "&") {
        if (expr.form === ExpressionResultType.RVALUE) {
            throw new SyntaxError(`you could not get address of a right value `, ctx.currentNode!);
        }
        loadAddress(ctx, expr);
        return {
            // 一个RValue的Pointer，代表Pointer的值在栈顶
            form: ExpressionResultType.RVALUE,
            type: new PointerType(expr.type),
            value: 0,
        };
    } else {
        throw new InternalError(`no_impl at unary ope=${this.operator}`);
    }
};

SubscriptExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    return new UnaryExpression(
        this.location,
        "*",
        new BinaryExpression(
            this.location,
            "+",
            this.array,
            this.subscript,
        ),
    ).codegen(ctx);
};

export function doVarInit(ctx: CompileContext, left: ExpressionResult,
                          right: ExpressionResult): ExpressionResult {
    // charptr, int, double
    const leftValue = left.value as number;
    if (right.type.equals(PrimitiveTypes.__ccharptr)) {
        if (!(left.type.equals(PrimitiveTypes.__charptr)) && !(left.type.equals(PrimitiveTypes.__ccharptr)) ) {
            throw new SyntaxError(`unsupport init from ${left.type} to ${right.type}`, ctx.currentNode!);
        }
        ctx.memory.data.setUint32(leftValue, right.value as number);
    }
    let rightValue = right.value as number;
    if (right.type instanceof IntegerType) {
        rightValue = (right.value as Long).toNumber();
    }
    if (left.type instanceof UnsignedCharType) {
        ctx.memory.data.setUint8(leftValue, rightValue);
    } else if (left.type instanceof CharType) {
        ctx.memory.data.setInt8(leftValue, rightValue);
    } else if (left.type instanceof UnsignedInt16Type) {
        ctx.memory.data.setUint16(leftValue, rightValue);
    } else if (left.type instanceof UnsignedInt32Type) {
        ctx.memory.data.setUint32(leftValue, rightValue);
    } else if (left.type instanceof UnsignedInt64Type) {
        if (right.type instanceof IntegerType) {
            ctx.memory.data.setUint32(leftValue, (right.value as Long).high);
            ctx.memory.data.setUint32(leftValue + 4, (right.value as Long).low);
        } else {
            ctx.memory.data.setUint32(leftValue, rightValue >> 32);
            ctx.memory.data.setUint32(leftValue + 4, rightValue);
        }
    } else if (left.type instanceof Int16Type) {
        ctx.memory.data.setInt16(leftValue, rightValue);
    } else if (left.type instanceof Int32Type) {
        ctx.memory.data.setInt32(leftValue, rightValue);
    } else if (left.type instanceof Int64Type) {
        if (right.type instanceof IntegerType) {
            ctx.memory.data.setInt32(leftValue, (right.value as Long).high);
            ctx.memory.data.setInt32(leftValue + 4, (right.value as Long).low);
        } else {
            ctx.memory.data.setInt32(leftValue, rightValue >> 32);
            ctx.memory.data.setInt32(leftValue + 4, rightValue);
        }
    } else if (left.type instanceof FloatType) {
        ctx.memory.data.setFloat32(leftValue, rightValue);
    } else if (left.type instanceof DoubleType) {
        ctx.memory.data.setFloat64(leftValue, rightValue);
    } else {
        throw new InternalError(`unsupport type assignment`);
    }
    return left;
}

/*
 *  规定：
 *  对于Type value的值是存值的地方的地址
 *  对于Lref value的值是存指针的地方的地址    （rval的话，stop是指针本体
 *  对于pointer value的值是存指针的地方的地址 （rval的话，stop是指针本体
 *
 *  所以 push
 *  ptr/type lvalue => laddr, lmtype
 *  ptr/type rvalue => none
 *  lref lvalue => laddr, lm32, lmtype
 *  lref rvalue => lm32, lmtype
 *
 *  &a的话 {type: ptr(int32), form: rvalue, value=> x 不是指针的地址，却是指针的值
 *
 *
 */

export function expression() {
    return "";
}
