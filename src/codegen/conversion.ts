/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {ExpressionResult, Node} from "../common/ast";
import {InternalError, SyntaxError, TypeError} from "../common/error";
import {
    ArithmeticType,
    ArrayType, ClassType, CompoundType,
    FunctionEntity, FunctionType,
    IntegerType,
    PointerType, PrimitiveType, PrimitiveTypes,
    Type,
} from "../common/type";
import {getTypeConvertOpe} from "../wasm/constant";
import {WConst, WCovertOperation} from "../wasm/expression";
import {WExpression} from "../wasm/node";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";

export function doTypeTransfrom(type: Type): Type {
    // array to pointer transform
    if (type instanceof ArrayType) {
        type = new PointerType(type.elementType);
    }

    // func to pointer transform
    // TODO::

    return type;
}

export function doValueTransform(ctx: CompileContext, expr: ExpressionResult, node: Node): ExpressionResult {
    // left value transform
    if (expr.isLeft) {
        expr.isLeft = false;
        if ( expr.expr instanceof FunctionEntity) {
            throw new SyntaxError(`unsupport function name`, node);
        }

        if ( !(expr.expr instanceof WAddressHolder)) {
            throw new InternalError(`if( !(expr.expr instanceof WAddressHolder)) {`);
        }

        expr.expr = expr.expr.createLoad(ctx, expr.type.toWType());

    }

    // array to pointer transform
    if (expr.type instanceof ArrayType) {
        expr.type = new PointerType(expr.type.elementType);
    }

    // func to pointer transform
    // TODO::

    return expr;
}

export function doConversion(ctx: CompileContext, dstType: Type, src: ExpressionResult,
                             node: Node, force: boolean = false): WExpression {
    src = doValueTransform(ctx, src, node);

    if ( src.expr instanceof FunctionEntity) {
        throw new SyntaxError(`unsupport function name`, node);
    }

    // arithmetic conversion
    if (dstType instanceof ArithmeticType && src.type instanceof ArithmeticType) {
        const srcWType = src.type.toWType();
        const dstWType = dstType.toWType();
        const ope = getTypeConvertOpe(srcWType, dstWType);
        if ( ope !== null ) {
            return new WCovertOperation(srcWType, dstWType, src.expr, ope, src.expr.location);
        } else {
            return src.expr;
        }
    }

    // pointer conversion

    if (dstType instanceof PointerType && src.type instanceof PointerType) {
        const dstElem = dstType.elementType;
        const srcElem = src.type.elementType;
        if ( (dstElem instanceof PrimitiveType || srcElem instanceof CompoundType)
            && (srcElem instanceof PrimitiveType || srcElem instanceof CompoundType)) {
            return src.expr;
        }
    }

    // 0 to pointer

    if (dstType instanceof PointerType && src.type instanceof IntegerType) {
        src.expr = src.expr.fold();
        if ( src.expr instanceof WConst && parseInt(src.expr.constant) === 0) {
            return src.expr;
        }
    }

    if (force) {
        // [Force] Integer to Pointer
        if ((dstType instanceof PointerType || dstType instanceof IntegerType)
            && (src.type instanceof PointerType || src.type instanceof IntegerType)) {
            return src.expr;
        }

        // any pointer to any pointer
        if (dstType instanceof PointerType && src.type instanceof PointerType) {
            return src.expr;
        }
    }

    throw new TypeError(`unsupport convert from ${src.type} to ${dstType}`, node);
}
