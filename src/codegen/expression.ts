/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 17/06/2018
 */
import * as Long from "long";
import {
    AssignmentExpression,
    BinaryExpression, CastExpression, CharacterConstant,
    ExpressionResult,
    ExpressionResultType,
    FloatingConstant,
    Identifier,
    IntegerConstant,
    ParenthesisExpression, PostfixExpression, StringLiteral,
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
    FloatType, getStackStorageType, Int16Type, Int32Type,
    Int64Type,
    IntegerType,
    LeftReferenceType,
    PointerType,
    PrimitiveTypes,
    QualifiedType, StackStorageType,
    Type,
    UnsignedCharType,
    UnsignedInt16Type,
    UnsignedInt32Type,
    UnsignedInt64Type,
    UnsignedIntegerType, VariableStorageType,
} from "../common/type";
import {FunctionEntity} from "../common/type";
import {CompileContext} from "./context";
import {
    convertTypeOnStack,
    loadAddress,
    loadIntoStack,
    loadReference,
    popFromStack,
    recycleExpressionResult,
} from "./stack";

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
    convertTypeOnStack(ctx, leftType, rightType);
    const left = this.left.codegen(ctx);
    if (leftType instanceof ClassType) {
        throw new SyntaxError(`unsupport operator overload`, this);
    }
    popFromStack(ctx, left);

    if ( this.parentIsStmt ) {
        // fake result
        return {
            type: PrimitiveTypes.void,
            form: ExpressionResultType.CONSTANT,
            value: 0,
        };
    }

    if ( left.form === ExpressionResultType.RVALUE) {
        // 这时往栈顶pop一次冗余操作
        return this.left.codegen(ctx);
    }

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
    } else if (item.storageType === VariableStorageType.CONSTANT) {
        return {
            type,
            form: ExpressionResultType.CONSTANT,
            value: Long.fromInt(item.location as number),
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
        } else if (ope === ">=") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+lhs.greaterThanOrEqual(rhs));
        } else if (ope === "<=") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+lhs.lessThanOrEqual(rhs));
        } else if (ope === ">") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+lhs.greaterThan(rhs));
        } else if (ope === "<") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+lhs.lessThan(rhs));
        } else if (ope === "==") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+lhs.equals(rhs));
        } else if (ope === "!=") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+lhs.notEquals(rhs));
        } else if (ope === "&") {
            result = lhs.and(rhs);
        } else if (ope === "|") {
            result = lhs.or(rhs);
        } else if (ope === "^") {
            result = lhs.xor(rhs);
        } else if (ope === "&&") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+((!lhs.isZero()) && (!rhs.isZero())) );
        } else if (ope === "||") {
            type = PrimitiveTypes.bool;
            result = Long.fromInt(+((!lhs.isZero()) || (!rhs.isZero())) );
        }
        return {
            type,
            form: ExpressionResultType.CONSTANT,
            value: result,
        };
    }
}

const BinaryOpTable = new Map<string, OpCode[][]>([
    ["+",  [[OpCode.ADD], [OpCode.ADDF]]],
    ["-",  [[OpCode.SUB], [OpCode.SUBF]]],
    ["*",  [[OpCode.MUL], [OpCode.MULF]]],
    ["/",  [[OpCode.DIV], [OpCode.DIVF]]],
    ["%",  [[OpCode.MOD], [OpCode.MODF]]],
    [">=", [[OpCode.SUB, OpCode.GTE0], [OpCode.SUBF, OpCode.D2I, OpCode.GTE0]]],
    ["<=", [[OpCode.SUB, OpCode.LTE0], [OpCode.SUBF, OpCode.D2I, OpCode.LTE0]]],
    [">",  [[OpCode.SUB, OpCode.GT0],  [OpCode.SUBF, OpCode.D2I, OpCode.GT0]]],
    ["<",  [[OpCode.SUB, OpCode.LT0],  [OpCode.SUBF, OpCode.D2I, OpCode.LT0]]],
    ["==", [[OpCode.SUB, OpCode.EQ0],  [OpCode.SUBF, OpCode.D2I, OpCode.EQ0]]],
    ["!=", [[OpCode.SUB, OpCode.NEQ0], [OpCode.SUBF, OpCode.D2I, OpCode.NEQ0]]],
    ["&",  [[OpCode.AND], [OpCode.NOP]]],
    ["|",  [[OpCode.OR], [OpCode.NOP]]],
    ["^",  [[OpCode.XOR], [OpCode.NOP]]],
    ["&&",  [[OpCode.LAND], [OpCode.LAND]]],
    ["||",  [[OpCode.LOR], [OpCode.LOR]]],
]);

const relationOpe = ["==", "!=", ">=", "<=", ">", "<"];

function generateExpressionTypeConversion(ctx: CompileContext,
                                          src: StackStorageType,
                                          dst: StackStorageType,
                                          ope: string) {
    // 执行运算时类型转换
    // 算术运算     完全转换
    // 比较运算     不转换浮点
    // 位运算       不转换
    // 逻辑运算     完全转换
    if (dst === StackStorageType.int32) {
        if (src === StackStorageType.int32 || src === StackStorageType.uint32) {
            return;
        } else if (src === StackStorageType.float32) {
            if ( !relationOpe.includes(ope)) {
                ctx.build(OpCode.F2D);
                ctx.build(OpCode.D2I);
            }
            return;
        } else if (src === StackStorageType.float64) {
            if ( !relationOpe.includes(ope)) {
                ctx.build(OpCode.D2I);
            }
            return;
        }
    } else if (dst === StackStorageType.uint32) {
        if ( src === StackStorageType.int32 || src === StackStorageType.uint32) {
            return;
        } else if ( src === StackStorageType.float32 ) {
            if ( !relationOpe.includes(ope)) {
                ctx.build(OpCode.F2D);
                ctx.build(OpCode.D2U);
            }
            return;
        } else if ( src === StackStorageType.float64 ) {
            if ( !relationOpe.includes(ope)) {
                ctx.build(OpCode.D2U);
            }
            return;
        }
    } else if ( dst === StackStorageType.float64) {
        if ( src === StackStorageType.float32) {
            ctx.build(OpCode.F2D);
            return;
        } else if ( src === StackStorageType.uint32) {
            ctx.build(OpCode.U2D);
            return;
        } else if ( src === StackStorageType.float64) {
            return;
        }
    }
    throw new InternalError("generateExpressionTypeConversion()");
}

BinaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    // 救救刘人语小姐姐

    const leftType = extractRealType(this.left.deduceType(ctx));
    const rightType = extractRealType(this.right.deduceType(ctx));
    // 计算结果不会出现const, array和引用，因为肯定在栈顶
    const targetType = this.deduceType(ctx);

    // 指针运算的时候要乘一个size
    if ( leftType instanceof PointerType &&
        rightType instanceof IntegerType &&
        "+-".includes(this.operator)) {
        this.right = new BinaryExpression(this.location,
            "*", this.right, IntegerConstant.fromNumber(
                this.location, leftType.elementType.length,
            ));
    }

    if ( rightType instanceof PointerType &&
        leftType instanceof IntegerType &&
        "+-".includes(this.operator)) {
        this.left = new BinaryExpression(this.location,
            "*", this.left, IntegerConstant.fromNumber(
                this.location, rightType.elementType.length,
            ));
    }

    const left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);

    if ( this.operator === ",") {
        return right;
    }

    const leftStorageType = getStackStorageType(leftType);
    const rightStorageType = getStackStorageType(rightType);

    // targetStorageType must be uint32 / int32 / float64
    let targetStorageType = getStackStorageType(targetType);

    // hack for relation ope
    if ( relationOpe.includes(this.operator) && (
        leftType instanceof FloatingType || rightType instanceof FloatingType)) {
        targetStorageType = StackStorageType.float64;
    }

    // 常量折叠
    if (left.form === ExpressionResultType.CONSTANT && right.form === ExpressionResultType.CONSTANT) {
        return doConstantCompute(left, right, this.operator);
    }

    ctx.currentNode = this;

    loadIntoStack(ctx, left);
    generateExpressionTypeConversion(ctx, leftStorageType, targetStorageType, this.operator);
    loadIntoStack(ctx, right);
    generateExpressionTypeConversion(ctx, rightStorageType, targetStorageType, this.operator);

    const insList = BinaryOpTable.get(this.operator)!;

    if (  targetStorageType === StackStorageType.float64 ) {
        insList[1].map((ins) => ctx.build(ins));
    } else if ( targetStorageType === StackStorageType.int32
        || targetStorageType === StackStorageType.uint32) {
        insList[0].map( (ins) => ctx.build(ins));
    } else {
        throw new InternalError(`BinaryExpression.prototype.codegen()`);
    }

    return {
        form: ExpressionResultType.RVALUE,
        type: targetType,
        value: 0,
    };
};

UnaryExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if ( this.operator === "sizeof") {
        return {
            type: PrimitiveTypes.uint32,
            form: ExpressionResultType.CONSTANT,
            value: this.operand.deduceType(ctx).length,
        };
    } else if ( this.operator === "++" || this.operator === "--") {
        return new BinaryExpression(this.location,
            this.operator.charAt(0),
            this.operand,
            IntegerConstant.getOne())
            .codegen(ctx);
    }
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
    } else if (["+", "-", "!", "~"].includes(this.operator)) {
        // + - => int, double
        // ~ => int
        // ! => int, double, pointer
        const rawType = extractRealType(expr.type);
        loadIntoStack(ctx, expr);
        if ( expr.form === ExpressionResultType.CONSTANT ) {
            let type: Type, value: Long | number;
            if ( rawType instanceof IntegerType) {
                type = rawType;
                const val = expr.value as Long;
                if ( this.operator === "-" ) {
                   value = val.negate();
                } else  if ( this.operator === "+" ) {
                    value = val;
                } else  if ( this.operator === "!" ) {
                    type = PrimitiveTypes.bool;
                    value = Long.fromInt(+val.isZero());
                } else  if ( this.operator === "~" ) {
                    value = val.not();
                } else {
                    throw new InternalError(`UnaryExpression.prototype.codegen`);
                }
            } else {
                type = rawType;
                const val = expr.value as number;
                if ( this.operator === "-" ) {
                    value = - val;
                } else  if ( this.operator === "+" ) {
                    value = val;
                } else  if ( this.operator === "!" ) {
                    type = PrimitiveTypes.bool;
                    value = +!val;
                } else {
                    throw new InternalError(`UnaryExpression.prototype.codegen`);
                }
            }
            return {
                type,
                form: ExpressionResultType.CONSTANT,
                value,
            };
        }
        if ( rawType instanceof IntegerType) {
            let retType = PrimitiveTypes.int32;
            if ( this.operator === "-" ) {
                ctx.build(OpCode.NEG);
            } else if ( this.operator === "+" ) {
                // empty
            } else if ( this.operator === "~" ) {
                ctx.build(OpCode.INV);
            } else if ( this.operator === "!" ) {
                ctx.build(OpCode.NOT);
                retType = PrimitiveTypes.bool;
            } else {
                throw new SyntaxError(`could not apply ${this.operator} on floating number`, this);
            }
            return {
                type: retType,
                form: ExpressionResultType.RVALUE,
                value: 0,
            };
        } else if ( rawType instanceof FloatingType) {
            let retType = PrimitiveTypes.double;
            if ( rawType instanceof FloatType) {
                ctx.build(OpCode.F2D);
            }
            if ( this.operator === "-" ) {
                ctx.build(OpCode.NEGF);
            } else if ( this.operator === "+" ) {
                // empty
            } else if ( this.operator === "!" ) {
                ctx.build(OpCode.D2I);
                ctx.build(OpCode.NOT);
                retType = PrimitiveTypes.bool;
            } else {
                throw new SyntaxError(`could not apply ${this.operator} on floating number`, this);
            }
            return {
                type: retType,
                form: ExpressionResultType.RVALUE,
                value: 0,
            };
        } else if ( rawType instanceof PointerType) {
            if ( this.operator === "!" ) {
                ctx.build(OpCode.NOT);
                return {
                    type: PrimitiveTypes.bool,
                    form: ExpressionResultType.RVALUE,
                    value: 0,
                };
            } else {
                throw new SyntaxError(`could not apply ${this.operator} on pointer`, this);
            }
        }
        throw new InternalError(`no_impl at unary ope=${this.operator}`);
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

CastExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const type = this.deduceType(ctx);
    const expr = this.operand.codegen(ctx);
    const exprType = extractRealType(expr.type);
    ctx.currentNode = this;
    if ( (type instanceof PointerType  || type instanceof IntegerType) &&
        (exprType instanceof PointerType || exprType instanceof IntegerType)
        ) {
        return {
            form: expr.form,
            type,
            value: expr.value,
        };
    } else if ( exprType.equals(type)) {
        return expr;
    } else if ( type instanceof FloatingType && exprType instanceof IntegerType) {
        loadIntoStack(ctx, expr);
        if ( exprType instanceof UnsignedIntegerType) {
            ctx.build(OpCode.U2D);
        } else {
            ctx.build(OpCode.I2D);
        }
        if ( type instanceof FloatType) {
            ctx.build(OpCode.D2F);
        }
        return {
            form: ExpressionResultType.RVALUE,
            type,
            value: 0,
        };
    } else if ( type instanceof IntegerType && exprType instanceof FloatingType) {
        if ( type instanceof FloatType) {
            ctx.build(OpCode.F2D);
        }
        loadIntoStack(ctx, expr);
        if ( type instanceof UnsignedIntegerType) {
            ctx.build(OpCode.D2U);
        } else {
            ctx.build(OpCode.D2I);
        }
        return {
            form: ExpressionResultType.RVALUE,
            type,
            value: 0,
        };
    }
    throw new SyntaxError(`unsupport cast from ${expr.type} to ${type}`, this);
    // TODO:: which is hard
};

PostfixExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const ope = this.operand.codegen(ctx);
    loadIntoStack(ctx, ope);
    recycleExpressionResult(ctx, new AssignmentExpression(this.location,
         "=", this.operand, new BinaryExpression(
             this.location, this.decrement ? "-" : "+", this.operand, IntegerConstant.getOne(),
        )).codegen(ctx));
    return {
        form: ExpressionResultType.RVALUE,
        type: ope.type,
        value: 0,
    };
};

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
