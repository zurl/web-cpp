/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 22/06/2018
 */
import {CompileContext} from "./context";
import {
    DoubleType, extractArithmeticType,
    FloatingType,
    FloatType,
    Int64Type,
    IntegerType,
    LeftReferenceType, PointerType,
    RightReferenceType,
    Type, UnsignedInt64Type
} from "../common/type";
import {Node, ExpressionResult, ExpressionResultType} from "../common/ast";
import {OpCode} from "./instruction";
import {InternalError, SyntaxError} from "../common/error";


export function convertTypeOnStack(ctx: CompileContext, dst: Type, src: Type, node: Node) {
    unsupportInt64(dst);
    unsupportInt64(src);
    if (dst instanceof IntegerType) {
        if (src instanceof IntegerType) {
            return;
        }
        else if (src instanceof FloatingType) {
            ctx.build(OpCode.D2I);
            return;
        }
    }
    else if (dst instanceof FloatingType) {
        if (src instanceof IntegerType) {
            ctx.build(OpCode.I2D);
            return;
        }
        else if (src instanceof FloatingType) {
            return;
        }
    }
    else if (dst instanceof PointerType) {
        if (src.equals(dst)) {
            return;
        }
    }
    throw new InternalError(`unsupport type assignment ${src.toString()} to ${dst.toString()}`);
}

function unsupportRRef(type: Type) {
    if (type instanceof RightReferenceType) {
        throw new InternalError(`unsupport right reference type`);
    }
}

function unsupportInt64(type: Type) {
    if (type instanceof Int64Type || type instanceof UnsignedInt64Type) {
        throw new InternalError(`unsupport int64 type`);
    }
}

export function loadConstant(ctx: CompileContext, value: ExpressionResult) {
    const rawType = extractArithmeticType(value.type);
    if (rawType instanceof IntegerType) {
        unsupportInt64(rawType);
        ctx.build(OpCode.LI32, value.value.toString());
    }
    else if (rawType instanceof DoubleType || rawType instanceof FloatType) {
        ctx.build(OpCode.LF64, value.value as number);
    }
    else {
        throw new InternalError(`load unsupport type into stack ${value.type.toString()}`);
    }
}

export function loadAddress(ctx: CompileContext, expr: ExpressionResult) {
    if (expr.form === ExpressionResultType.RVALUE) {
        throw new InternalError(`new loadAddress(), rvalue`)
        //ctx.build(OpCode.LSP, 0);
    }
    else if (expr.form === ExpressionResultType.LVALUE_STACK) {
        ctx.build(OpCode.LBP, expr.value as number)
    }
    else if (expr.form === ExpressionResultType.LVALUE_MEMORY_DATA) {
        ctx.build(OpCode.LDATA, expr.value as number)
    }
    else if (expr.form === ExpressionResultType.LVALUE_MEMORY_BSS) {
        ctx.build(OpCode.LBSS, expr.value as number)
    }
    else if (expr.form === ExpressionResultType.LVALUE_MEMORY_EXTERN) {
        ctx.unresolve(expr.value as string);
        ctx.build(OpCode.LDATA, 0)
    }
    else {
        throw new InternalError(`no_impl at load Address`);
    }
}

// int32        value => addr to
// int32*


/**
 * 目的：把一个reference的值 放到stacktop
 *
 * Type = reference
 * lval value表示指针的地址     => LADDR, LM32(现在指针在stop), LM32
 * rval 指针在stop             => LM32
 * @param {CompileContext} ctx
 * @param {ExpressionResult} expr
 */
export function loadReference(ctx: CompileContext, expr: ExpressionResult){
    if(!(expr.type instanceof LeftReferenceType) || expr.form === ExpressionResultType.CONSTANT){
        throw new InternalError(`loadReference()`);
    }
    if(expr.form != ExpressionResultType.RVALUE){
        loadAddress(ctx, expr);
        ctx.build(OpCode.LM32);
    }
    ctx.build(OpCode.LM32);
}

export function loadFromMemory(ctx: CompileContext, type: Type){
    if (type instanceof IntegerType || type instanceof FloatingType || type instanceof PointerType) {
        if (type.length == 1) {
            ctx.build(OpCode.LM8);
        }
        else if (type.length == 2) {
            ctx.build(OpCode.LM16);
        }
        else if (type.length == 4) {
            ctx.build(OpCode.LM32);
        }
        else if (type.length == 8) {
            ctx.build(OpCode.LM64);
        }
        else {
            throw new InternalError(`load unsupport length into stack ${type.toString()}`);
        }
    }
    else {
        throw new InternalError(`load unsupport type into stack ${type.toString()}`);
    }
}

/**
 * 这里可以load两种类型的
 一种原始类型 value保存的是他的地址 直接load
 一种引用类型 实际上是个指针 value保存的是储存他的地址的地址
 首先要loadReference， 这时候 stacktop 保存的是他的地址 然后再次执行decode
 对于RVL_PTR
 * @param {CompileContext} ctx
 * @param {ExpressionResult} expr
 */
export function loadIntoStack(ctx: CompileContext, expr: ExpressionResult) {
    if (expr.type instanceof LeftReferenceType) {
        loadFromMemory(ctx, expr.type.elementType);
        return;
    }
    const rawType = extractArithmeticType(expr.type);
    unsupportInt64(rawType);
    unsupportRRef(expr.type);
    if (expr.form === ExpressionResultType.CONSTANT) {
        loadConstant(ctx, expr);
    }
    else if (expr.form === ExpressionResultType.LVALUE_STACK
        || expr.form === ExpressionResultType.LVALUE_MEMORY_DATA
        || expr.form === ExpressionResultType.LVALUE_MEMORY_BSS
        || expr.form === ExpressionResultType.LVALUE_MEMORY_EXTERN
    ) {
        if (expr.form === ExpressionResultType.LVALUE_MEMORY_EXTERN) {
            ctx.unresolve(expr.value as string);
            expr.value = 0;
        }
        loadAddress(ctx, expr);
        loadFromMemory(ctx, expr.type);
    }
    else if (expr.form === ExpressionResultType.RVALUE) {
        // already on stack
        return;
    }
    else {
        throw new InternalError(`unsupport form in popFromStack`)
    }
}
export function saveToMemory(ctx: CompileContext, type: Type){
    if (type instanceof IntegerType || type instanceof FloatingType || type instanceof PointerType) {
        if (type.length == 1) {
            ctx.build(OpCode.SM8);
        }
        else if (type.length == 2) {
            ctx.build(OpCode.SM16);
        }
        else if (type.length == 4) {
            ctx.build(OpCode.SM32);
        }
        else if (type.length == 8) {
            ctx.build(OpCode.SM64);
        }
        else {
            throw new InternalError(`load unsupport length into stack ${type.toString()}`);
        }
    }
    else {
        throw new InternalError(`unsupport form in loadIntoStakc`)
    }
}
/**
 * 这里也可以pop两种类型
 * 普通类型push dest地址 然后SM
 * 引用类型的话 value存的是存有目的地址的地址，
 * 首先loadreference 现在stacktop有目的地址 然后直接sm
 * @param {CompileContext} ctx
 * @param {ExpressionResult} expr
 */
export function popFromStack(ctx: CompileContext, expr: ExpressionResult) {
    if (expr.type instanceof LeftReferenceType) {
        saveToMemory(ctx, expr.type.elementType);
        return
    }
    const rawType = extractArithmeticType(expr.type);
    unsupportInt64(rawType);
    unsupportRRef(expr.type);
    loadAddress(ctx, expr);
    if (expr.form === ExpressionResultType.LVALUE_MEMORY_EXTERN) {
        ctx.unresolve(expr.value as string);
        expr.value = 0;
    }
    if (expr.form === ExpressionResultType.LVALUE_STACK
        || expr.form === ExpressionResultType.LVALUE_MEMORY_DATA
        || expr.form === ExpressionResultType.LVALUE_MEMORY_BSS
        || expr.form === ExpressionResultType.LVALUE_MEMORY_EXTERN
    ) {
        saveToMemory(ctx, expr.type);
    }
    else {
        throw new InternalError(`unsupport form in loadIntoStakc`)
    }
}
const a = 1;