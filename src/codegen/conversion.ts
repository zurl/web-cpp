/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {InternalError, SyntaxError, TypeError} from "../common/error";
import {Node} from "../common/node";
import {AddressType} from "../common/symbol";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {ArrayType, LeftReferenceType, PointerType, ReferenceType} from "../type/compound_type";
import {FunctionType, UnresolvedFunctionOverloadType} from "../type/function_type";
import {
    ArithmeticType,
    FloatingType,
    FloatType, Int64Type,
    IntegerType,
    PrimitiveTypes,
    UnsignedInt64Type, UnsignedIntegerType,
} from "../type/primitive_type";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {ExpressionResult} from "./expression/expression";
import {doFunctionOverloadResolution} from "./overload";
import {getTypeConvertOpe, WConst, WCovertOperation, WExpression, WGetFunctionAddress} from "../wasm";

export function arithmeticDeduce(left: ArithmeticType, right: ArithmeticType): ArithmeticType {
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

export function doTypeTransfrom(type: Type): Type {
    // array to pointer transform
    if (type instanceof ArrayType) {
        type = new PointerType(type.elementType);
    }

    if (type instanceof ReferenceType) {
        type = type.elementType;
    }
    // func to pointer transform
    // TODO::

    return type;
}

export function doReferenceTransform(ctx: CompileContext, left: ExpressionResult,
                                     node: Node) {

    if ( left.type instanceof LeftReferenceType ) {
        if ( !left.isLeft || !(left.expr instanceof WAddressHolder)) {
            left.type = left.type.elementType;
            left.expr = new WAddressHolder(left.expr, AddressType.RVALUE, node.location);
        } else {
            left.type = left.type.elementType;
            left.expr = new WAddressHolder(left.expr.createLoad(ctx, PrimitiveTypes.uint32),
                AddressType.RVALUE, node.location);
        }
    }
    return left;
}

export function doValueTransform(ctx: CompileContext, expr: ExpressionResult,
                                 node: Node, toReference = false): ExpressionResult {

    if ( !expr.isLeft && expr.type instanceof LeftReferenceType) {
        throw new InternalError(`LeftReferenceType could not be rvalue`);
    }

    // left value transform
    if (expr.isLeft) {
        expr.isLeft = false;

        if ( expr.type instanceof LeftReferenceType && !(expr.expr instanceof WAddressHolder) ) {
            expr.type = expr.type.elementType;
            expr.expr = new WAddressHolder(expr.expr, AddressType.RVALUE, node.location);
        }

        if ( !(expr.expr instanceof WAddressHolder)) {
            throw new InternalError(`if( !(expr.expr instanceof WAddressHolder)) {`);
        }

        if (expr.type instanceof ClassType && !toReference) {
            throw new SyntaxError(`you should not convert a class to rvalue`, node);
        }

        if ( expr.type instanceof ArrayType ) {
            if ( toReference ) {
                throw new SyntaxError(`no reference to array`, node);
            }
            expr.type = new PointerType(expr.type.elementType);
            expr.expr = expr.expr.createLoadAddress(ctx);
        } else if ( expr.type instanceof LeftReferenceType) {
            if ( toReference ) {
                expr.expr = expr.expr.createLoad(ctx, PrimitiveTypes.uint32);
            } else {
                expr.type = expr.type.elementType;
                expr.expr = new WAddressHolder(expr.expr.createLoad(ctx, PrimitiveTypes.uint32),
                    AddressType.RVALUE, node.location).createLoad(ctx, expr.type);
            }
        } else {
            if ( toReference ) {
                expr.type = new LeftReferenceType(expr.type);
                expr.expr = expr.expr.createLoadAddress(ctx);
            } else {
                expr.expr = expr.expr.createLoad(ctx, expr.type);
            }
        }
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
                             node: Node, force: boolean = false, toReference: boolean = false): WExpression {

    const shouldToReference = toReference && (dstType instanceof LeftReferenceType);
    src = doValueTransform(ctx, src, node, shouldToReference);

    // to remove??
    if ( src.type instanceof UnresolvedFunctionOverloadType) {
        if ( dstType instanceof PointerType && dstType.elementType instanceof FunctionType) {
            const item = doFunctionOverloadResolution(ctx, src.type.functionLookupResult,
                dstType.elementType.parameterTypes, node);
            return new WGetFunctionAddress(item.fullName, node.location);
        }
        throw new SyntaxError(`unsupport function name`, node);
    }

    if ( dstType instanceof LeftReferenceType && src.type instanceof LeftReferenceType) {
        if ( dstType.equals(src.type)) {
            return src.expr;
        }
    }

    if (dstType instanceof ArrayType) {
        dstType = new PointerType(dstType.elementType);
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
        if ( dstElem.equals(PrimitiveTypes.void) || srcElem.equals(dstElem)) {
            return src.expr;
        }
        if ( dstElem instanceof ClassType && srcElem instanceof ClassType ) {
            // son to parent;
            if ( srcElem.isSubClassOf(dstElem) ) {
                return src.expr;
            }
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

export function getInStackSize(size: number): number {
    if ( size % 4 === 0) { return size; }
    return size + 4 - (size % 4);
}

export function doValuePromote(ctx: CompileContext, src: ExpressionResult, node: Node): ExpressionResult {
    src = doValueTransform(ctx, src, node, false);
    if ( src.type instanceof IntegerType && src.type.length < 4 ) {
        src.type = PrimitiveTypes.int32;
    }
    if ( src.type instanceof FloatType ) {
        src.expr = doConversion(ctx, PrimitiveTypes.double, src, node);
        src.type = PrimitiveTypes.double;
    }
    return src;
}

export function doTypePromote(ctx: CompileContext, src: Type, node: Node): Type {
    if (src instanceof ArrayType) {
        src = new PointerType(src.elementType);
    }
    if ( src instanceof IntegerType && src.length < 4 ) {
        src = PrimitiveTypes.int32;
    }
    if ( src instanceof FloatType ) {
        src = PrimitiveTypes.double;
    }
    return src;
}
