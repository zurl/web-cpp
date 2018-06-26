/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 17/06/2018
 */
import {InternalError, SyntaxError} from "../common/error";
import {
    ArithmeticType,
    ArrayType,
    ClassType,
    CompoundType,
    DoubleType,
    extractArithmeticType,
    FloatingType,
    FloatType,
    Int64Type,
    IntegerType,
    LeftReferenceType,
    PointerType,
    PrimitiveType,
    PrimitiveTypes,
    QualifiedType,
    ReferenceType,
    RightReferenceType,
    Type,
    UnsignedCharType,
    UnsignedInt64Type,
    UnsignedIntegerType
} from "../common/type";
import {
    Node,
    AssignmentExpression,
    BinaryExpression,
    Constant,
    Expression,
    ExpressionResult,
    ExpressionResultType,
    FloatingConstant,
    FunctionDefinition,
    Identifier,
    IntegerConstant,
    UnaryExpression,
    ParenthesisExpression
} from "../common/ast";
import {CompileContext} from "./context";
import * as Long from "long";
import {OpCode} from "../common/instruction";
import {FunctionEntity, VariableStorageType} from "./scope";
import {convertTypeOnStack, loadAddress, loadIntoStack, loadReference, popFromStack} from "./stack";

ParenthesisExpression.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    return this.expression.codegen(ctx);
};

AssignmentExpression.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;

    const right = this.right.codegen(ctx);
    const leftType = extractArithmeticType(this.left.deduceType(ctx));
    const rightType = extractArithmeticType(right.type);
    if (rightType instanceof ClassType) {
        throw new SyntaxError(`unsupport operator overload`, this);
    }
    loadIntoStack(ctx, right);
    // OK, Value on the top of stack, then retrieve
    convertTypeOnStack(ctx, leftType, rightType, this);

    const left = this.left.codegen(ctx);

    if (leftType instanceof ClassType) {
        throw new SyntaxError(`unsupport operator overload`, this);
    }


    popFromStack(ctx, left);
    //TODO:: 我都不知道我在干啥
    return {
        type: leftType,
        form: left.form,
        value: left.value,
    }
};

IntegerConstant.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    let type = PrimitiveTypes.int32;
    if (this.suffix) {
        if (this.suffix.toUpperCase().indexOf("U") != -1) {
            if (this.suffix.toUpperCase().indexOf("LL") != -1) {
                type = PrimitiveTypes.uint64;
            }
            else {
                type = PrimitiveTypes.uint32;
            }
        }
        else {
            if (this.suffix.toUpperCase().indexOf("LL") != -1) {
                type = PrimitiveTypes.int64;
            }
            else {
                type = PrimitiveTypes.int32;
            }
        }
    }
    return {
        type: type,
        form: ExpressionResultType.CONSTANT,
        value: this.value,
    }
};

FloatingConstant.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    let type = PrimitiveTypes.double;
    if (this.suffix && this.suffix.toUpperCase() == "f") {
        type = PrimitiveTypes.float;
    }
    return {
        type: type,
        form: ExpressionResultType.CONSTANT,
        value: this.value,
    }
};

Identifier.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    let item = ctx.currentScope.get(this.name);
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
            value: item.fullName,
            isConst: true,
        }
    }

    let type = item.type, isConst = false;
    while (type instanceof QualifiedType) {
        if (type.isConst) isConst = true;
        type = type.elementType;
    }

    if (item.storageType === VariableStorageType.STACK) {
        return {
            type: type,
            form: ExpressionResultType.LVALUE_STACK,
            value: item.location,
            isConst: isConst,
        }
    }
    else if (item.storageType === VariableStorageType.MEMORY_DATA) {
        return {
            type: type,
            form: ExpressionResultType.LVALUE_MEMORY_DATA,
            value: item.location,
            isConst: isConst,
        }
    }
    else if (item.storageType === VariableStorageType.MEMORY_BSS) {
        return {
            type: type,
            form: ExpressionResultType.LVALUE_MEMORY_BSS,
            value: item.location,
            isConst: isConst,
        }
    }
    else if (item.storageType === VariableStorageType.MEMORY_EXTERN) {
        return {
            type: type,
            form: ExpressionResultType.LVALUE_MEMORY_EXTERN,
            value: item.location,
            isConst: isConst,
        }
    }
    else {
        throw new InternalError(`unknown error at item.storageType`);
    }
};


// Require: left.type and right.type instanceof ArithmeticType
function doConstantCompute(left: ExpressionResult, right: ExpressionResult, ope: string): ExpressionResult {
    if (left.type instanceof FloatingType || right.type instanceof FloatingType) {
        let lhs = left.value, rhs = right.value, type = PrimitiveTypes.float;
        if (left.type instanceof IntegerType) lhs = (left.value as Long).toNumber();
        if (right.type instanceof IntegerType) rhs = (right.value as Long).toNumber();
        if (left.type instanceof DoubleType || right.type instanceof DoubleType) {
            type = PrimitiveTypes.double
        }
        return {
            type: type,
            form: ExpressionResultType.CONSTANT,
            value: eval(`${lhs}${ope}${rhs}`)
        }
    }
    else {
        let lhs = left.value as Long, rhs = right.value as Long, type = PrimitiveTypes.int32, result = lhs;
        if (left.type instanceof UnsignedInt64Type || right.type instanceof UnsignedInt64Type) {
            type = PrimitiveTypes.uint64
        }
        if (left.type instanceof Int64Type || right.type instanceof Int64Type) {
            type = PrimitiveTypes.int64
        }
        if (ope == "+") {
            result = lhs.add(rhs);
        }
        else if (ope == "-") {
            result = lhs.sub(rhs);
        }
        else if (ope == "*") {
            result = lhs.mul(rhs);
        }
        else if (ope == "/") {
            result = lhs.div(rhs);
        }
        else if (ope == "%") {
            result = lhs.mod(rhs);
        }
        return {
            type: type,
            form: ExpressionResultType.CONSTANT,
            value: result
        }
    }
}


const ArithmeticOpTable = new Map<string, OpCode[]>([
    ["+", [OpCode.ADD, OpCode.ADDU, OpCode.ADDF]],
    ["-", [OpCode.SUB, OpCode.ADDU, OpCode.ADDF]],
    ["*", [OpCode.MUL, OpCode.ADDU, OpCode.ADDF]],
    ["/", [OpCode.DIV, OpCode.ADDU, OpCode.ADDF]],
    ["%", [OpCode.MOD, OpCode.ADDU, OpCode.ADDF]]
]);

function genArithmeticExpression(expr: BinaryExpression, ctx: CompileContext,
                                 left: ExpressionResult, right: ExpressionResult): ExpressionResult {
    const leftType = extractArithmeticType(left.type);
    const rightType = extractArithmeticType(right.type);
    if (leftType instanceof ArithmeticType && rightType instanceof ArithmeticType) {
        if (left.form == ExpressionResultType.CONSTANT && right.form == ExpressionResultType.CONSTANT) {
            return doConstantCompute(left, right, expr.operator);
        }
        else {
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
            if (leftType instanceof FloatingType || rightType instanceof FloatingType) {
                ctx.build((ArithmeticOpTable.get(expr.operator) as OpCode[])[2]);
                type = PrimitiveTypes.double;
            }
            else if (leftType instanceof UnsignedIntegerType || rightType instanceof UnsignedIntegerType) {
                ctx.build((ArithmeticOpTable.get(expr.operator) as OpCode[])[1]);
                type = PrimitiveTypes.uint32;
            }
            else {
                ctx.build((ArithmeticOpTable.get(expr.operator) as OpCode[])[0]);
                type = PrimitiveTypes.int32;
            }
            return {
                form: ExpressionResultType.RVALUE,
                type: type,
                value: 0
            };
        }
    }
    else {
        throw new SyntaxError(`the operation ${expr.operator} could not be applied on `
            + `${left.type.toString()} and ${right.type.toString()}`, expr)
    }
}


function genPointerCompute(ctx: CompileContext, ope: string,  left: ExpressionResult, right: ExpressionResult): ExpressionResult {
    if(left.type instanceof PointerType && right.type instanceof PointerType){
        throw new SyntaxError(`unsupport operation between`, ctx.currentNode!);
    }
    else{
        loadIntoStack(ctx, left);
        loadIntoStack(ctx, right);
        if(ope === "+"){
            ctx.build(OpCode.ADDU);
        }
        else if(ope === "-"){
            ctx.build(OpCode.SUBU);
        }
        else{
            throw new InternalError(`doPointerCompute()`);
        }
        return {
            form: ExpressionResultType.RVALUE,
            type: left.type,
            value: 0
        }
    }
}

BinaryExpression.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    // 救救刘人语小姐姐
    const left = this.left.codegen(ctx);
    const right = this.right.codegen(ctx);
    ctx.currentNode = this;
    if (left.type instanceof ClassType || right.type instanceof ClassType) {
        throw new InternalError(`unsupport operator overload`);
    }
    if( left.type instanceof PointerType || right.type instanceof PointerType){
        if("+-".indexOf(this.operator) != - 1){
            return genPointerCompute(ctx, this.operator, left, right);
        }
        else{
            throw new SyntaxError(`unsupport ope between ${left.type.toString()} an ${right.type.toString()}`, this);
        }
    }
    else if ("+-*/%".indexOf(this.operator) != -1) {
        return genArithmeticExpression(this, ctx, left, right);
    }
    else {
        throw new InternalError(`unsupport operator`);
    }
};

UnaryExpression.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    const expr = this.operand.codegen(ctx);
    ctx.currentNode = this;
    if( this.operator === "*"){
        if( expr.type instanceof PointerType){
            //
            //* lval value表示指针的地址     => LADDR, LM32
            //* rval 指针在stop             => LM32
            if(expr.form != ExpressionResultType.RVALUE){
                loadAddress(ctx, expr);
                ctx.build(OpCode.LM32);
            }
            return {
                form : ExpressionResultType.RVALUE, // pointer的本体在栈顶
                type: new LeftReferenceType(expr.type.elementType),
                value: 0
            }
        }
        else if( expr.type instanceof LeftReferenceType
            && expr.type.elementType instanceof PointerType){
            // 这是一个pointer的引用，所以pointer本身的地址在rvalue里
            //
            loadReference(ctx, expr);
            return {
                form: ExpressionResultType.RVALUE,
                type: new LeftReferenceType(expr.type.elementType.elementType),
                value: 0
            }
        }
        else{
            throw new SyntaxError(`you could not apply * on ${expr.type.toString()} `, this);
        }
    }
    else if(this.operator === "&"){
        if( expr.form ===  ExpressionResultType.RVALUE) {
            throw new SyntaxError(`you could not get address of a right value `, ctx.currentNode!);
        }
        loadAddress(ctx, expr);
        return {
            // 一个RValue的Pointer，代表Pointer的值在栈顶
            form: ExpressionResultType.RVALUE,
            type: new PointerType(expr.type),
            value: 0,
        }
    }
    else{
        throw new InternalError(`no_impl at unary ope=${this.operator}`);
    }
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
    const a = 1;
    return "";
}