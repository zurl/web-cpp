import {InternalError, SyntaxError} from "../common/error";
import {AddressType} from "../common/symbol";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {ArrayType, ConstType, LeftReferenceType, PointerType, ReferenceType} from "../type/compound_type";
import {FunctionType, UnresolvedFunctionOverloadType} from "../type/function_type";
import {ArithmeticType, FloatType, IntegerType, PrimitiveTypes} from "../type/primitive_type";
import {
    F64Convert,
    getTypeConvertOpe,
    WConst,
    WCovertOperation,
    WEmptyExpression,
    WExpression,
    WGetFunctionAddress,
    WType,
} from "../wasm";
import {WAddressHolder} from "./address";
import {ConstructorCallExpression} from "./class/constructor_call_expression";
import {CompileContext} from "./context";
import {AnonymousExpression} from "./expression/anonymous_expression";
import {ExpressionResult, recycleExpressionResult} from "./expression/expression";
import {Identifier} from "./expression/identifier";
import {CallExpression} from "./function/call_expression";
import {doFunctionOverloadResolution} from "./overload";

export class TypeConverter {

    public static fromType(type: Type) {
        return new TypeConverter({type, expr: WEmptyExpression.instance});
    }

    public type: Type;
    public expr: WExpression;

    constructor(result: ExpressionResult) {
        this.type = result.type;
        this.expr = result.expr;
    }

    public removeReference(ctx: CompileContext): ExpressionResult {
        if ( this.type instanceof LeftReferenceType ) {
            if (!(this.expr instanceof WAddressHolder)) {
                throw new InternalError(`reference must be reference`);
            }
            return {
                type: this.type.elementType,
                expr: new WAddressHolder(this.expr.createLoadAddress(ctx),
                    AddressType.RVALUE, this.expr.location),
            };
        }
        return {
            type: this.type,
            expr: this.expr,
        };
    }

    public promote(ctx: CompileContext): ExpressionResult {
        let dstType = this.type;
        if (dstType instanceof ClassType) {
            throw new SyntaxError(`class type could not be promote`, this.expr);
        }
        if (dstType instanceof ArrayType) {
            dstType = new PointerType(dstType.elementType);
        }
        if ( dstType instanceof IntegerType && dstType.length < 4 ) {
            dstType = PrimitiveTypes.int32;
        }
        if ( dstType instanceof FloatType ) {
            dstType = PrimitiveTypes.double;
        }
        if ( dstType instanceof LeftReferenceType ) {
            dstType = dstType.elementType;
        }
        return this.tryConvertTo(ctx, dstType, false);
    }

    public tryConvertTo(ctx: CompileContext, dstType: Type, computeValue: boolean = true,
                        force: boolean = false): ExpressionResult {
        const result = this.convertTo(ctx, dstType, force, computeValue);
        if (!result ) {
            throw new SyntaxError(`cannot convert from ${this.type.toString()}`
                + ` to ${dstType.toString()}`, this.expr);
        }
        return {
            type: dstType,
            expr: result,
        };
    }

    public convertByConstructor(ctx: CompileContext, dstType: ClassType, srcType: Type, srcExpr: WExpression)
        : WExpression | null {
        try {
            const expr = new ConstructorCallExpression(srcExpr.location,
                Identifier.fromString(srcExpr.location, dstType.fullName, true),
                [new AnonymousExpression(srcExpr.location, {
                    expr: srcExpr,
                    type: srcType,
                })]);
            if (this.expr instanceof WEmptyExpression) {
                // only test if ok, no allocation
                expr.deduceType(ctx);
                return this.expr;
            } else {
                const ret = expr.codegen(ctx);
                if (ret.expr instanceof WAddressHolder) {
                    ret.expr = ret.expr.createLoad(ctx, ret.type);
                }
                return ret.expr;
            }
        } catch (e) {
            return null;
        }
    }

    public convertByOverload(ctx: CompileContext, dstType: Type, srcType: ClassType, srcExpr: WExpression)
        : WExpression | null {
        try {
            const name = Identifier.fromString(srcExpr.location, srcType.fullName + "::#" + dstType.toMangledName());
            if (dstType instanceof ClassType) {
                if (srcExpr instanceof WEmptyExpression) {
                    const thisVar = new AnonymousExpression(srcExpr.location,
                        {type: dstType, expr: WEmptyExpression.instance});
                    const expr = new CallExpression(srcExpr.location, name,
                        [thisVar, new AnonymousExpression(srcExpr.location, {expr: srcExpr, type: srcType})]);
                    expr.deduceType(ctx);
                    return this.expr;
                } else {
                    const thisVar = Identifier.allocTmpVar(ctx, dstType, srcExpr);
                    const expr = new CallExpression(srcExpr.location, name,
                        [thisVar, new AnonymousExpression(srcExpr.location, {expr: srcExpr, type: srcType})]);
                    recycleExpressionResult(ctx, expr.codegen(ctx));
                    const ret = thisVar.codegen(ctx);
                    if (ret.expr instanceof WAddressHolder) {
                        ret.expr = ret.expr.createLoad(ctx, ret.type);
                    }
                    return ret.expr;
                }
            } else {
                const expr = new CallExpression(srcExpr.location, name,
                    [new AnonymousExpression(srcExpr.location, {expr: srcExpr, type: srcType})]);
                if (srcExpr instanceof WEmptyExpression) {
                    expr.deduceType(ctx);
                    return this.expr;
                } else {
                    const ret = expr.codegen(ctx);
                    if (ret.expr instanceof WAddressHolder) {
                        ret.expr = ret.expr.createLoad(ctx, ret.type);
                    }
                    return ret.expr;
                }
            }
        } catch (e) {
            return null;
        }
    }

    public toRValue(ctx: CompileContext): ExpressionResult {
        let dstType = this.type;
        if (dstType instanceof LeftReferenceType) {
            dstType = dstType.elementType;
        }
        if (dstType instanceof ConstType && dstType.elementType instanceof LeftReferenceType) {
            dstType = new ConstType(dstType.elementType.elementType);
        }
        if (dstType instanceof ArrayType) {
            dstType = new PointerType(dstType.elementType);
        }
        return this.tryConvertTo(ctx, dstType, true, false);
    }

    // use in function call, assignment
    // implementation of C++ standard conversion sequence
    // https://en.cppreference.com/w/cpp/language/implicit_conversion
    // force: apply force conversion ( explicit conversion )
    // computeexpr: true for function call + cond-expr, false for other
    public convertTo(ctx: CompileContext, dstType: Type, force: boolean, computeexpr: boolean)
        : WExpression | null {
        // try remove const
        let srcType = this.type;
        let srcExpr = this.expr;

        if (dstType instanceof ConstType && !(srcType instanceof ConstType)) {
            dstType = dstType.elementType;
        }

        if (force && srcType instanceof ConstType && !(dstType instanceof ConstType)) {
            srcType = srcType.elementType;
        }

        if (srcType instanceof ArrayType) {
            srcType = new PointerType(srcType.elementType);
            if (srcExpr instanceof WAddressHolder) {
                srcExpr = srcExpr.createLoadAddress(ctx);
            }
        }

        // if dst = reference, computeexpr = false, directly pass it
        const toReference = (!computeexpr) && (dstType instanceof LeftReferenceType);

        // if dst = reference, src.elem = dst
        if (dstType instanceof ReferenceType && srcType.equals(dstType.elementType)) {
            // todo:: const reference binding
            if (srcExpr instanceof WAddressHolder) {
                return srcExpr.createLoadAddress(ctx);
            } else {
                throw new SyntaxError(`you could not convert a right value to reference`,
                    this.expr);
            }
        }

        // if dst = class, try constructor + type overload
        if (dstType instanceof ClassType) {
            const result = this.convertByConstructor(ctx, dstType, srcType, srcExpr);
            if (result) {
                return result;
            }
        }

        // try convert left expr
        if (srcExpr instanceof WAddressHolder) {
            if (srcType instanceof LeftReferenceType) {
                if ( toReference ) {
                    srcExpr = srcExpr.createLoadAddress(ctx);
                } else {
                    srcType = srcType.elementType;
                    if (srcType instanceof ArrayType) {
                        srcType = new PointerType(srcType.elementType);
                        srcExpr = srcExpr.createLoadAddress(ctx);
                    } else {
                        srcExpr = srcExpr.createLoad(ctx, srcType);
                    }
                }
            } else if (srcType instanceof ArithmeticType || srcType instanceof PointerType) {
                if ( toReference ) {
                    srcType = new LeftReferenceType(srcType);
                    srcExpr = srcExpr.createLoadAddress(ctx);
                } else {
                    srcExpr = srcExpr.createLoad(ctx, srcType);
                }
            } else {
                return null;
            }
        }

        // standard conversion sequence

        srcExpr = srcExpr.fold();
        const isConstZero = srcExpr instanceof WConst && srcExpr.constant === "0";

        if (srcType instanceof ArithmeticType) {
            if (dstType instanceof ArithmeticType) {
                const srcWType = srcType.toWType();
                const dstWType = dstType.toWType();
                const ope = getTypeConvertOpe(srcWType, dstWType);
                if ( ope !== null ) {
                    return new WCovertOperation(srcWType, dstWType, srcExpr, ope, srcExpr.location);
                } else {
                    return srcExpr;
                }
            } else if (dstType instanceof PointerType && srcType instanceof IntegerType
                && (force || isConstZero) ) {
                return srcExpr;
            }
        } else if (srcType instanceof PointerType) {
            if (dstType instanceof PointerType) {
                if (force) {
                    return srcExpr;
                }
                const dstElem = dstType.elementType;
                const srcElem = srcType.elementType;
                if ( dstElem.equals(PrimitiveTypes.void) || srcElem.equals(dstElem)) {
                    return srcExpr;
                }
                if ( dstElem instanceof ClassType && srcElem instanceof ClassType ) {
                    // son to parent;
                    if ( srcElem.isSubClassOf(dstElem) ) {
                        return srcExpr;
                    }
                }
                return null;
            } else if (dstType instanceof IntegerType && force) {
                return srcExpr;
            }
        } else if (srcType instanceof LeftReferenceType) {
            if (dstType instanceof LeftReferenceType && dstType.equals(srcType)) {
                return srcExpr;
            }
        } else if (srcType instanceof UnresolvedFunctionOverloadType) {
            if ( dstType instanceof PointerType && dstType.elementType instanceof FunctionType) {
                const item = doFunctionOverloadResolution(ctx, srcType.functionLookupResult,
                    dstType.elementType.parameterTypes, srcExpr);
                return new WGetFunctionAddress(item.fullName, srcExpr.location);
            }
        } else if (srcType instanceof ClassType) {
            return this.convertByOverload(ctx, dstType, srcType, srcExpr);
        }

        return null;
    }

}

export function isCompatWith(ctx: CompileContext, dst: Type, src: Type): boolean {
    if (src.equals(dst)) {
        return true;
    }
    if (src instanceof ClassType && dst instanceof ClassType) {
        return src.isSubClassOf(dst);
    }
    return new TypeConverter({type: src, expr: WEmptyExpression.instance})
        .convertTo(ctx, dst, false, false) !== null;
}
