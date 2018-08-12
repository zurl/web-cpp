/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 21/07/2018
 */
import {ExpressionResult, Node} from "../../common/ast";
import {InternalError} from "../../common/error";
import {ClassType} from "../../type/class_type";
import {LeftReferenceType, ReferenceType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {doConversion, doValueTransform} from "../conversion";
import {FunctionLookUpResult} from "../scope";

export function doReferenceBinding(ctx: CompileContext, dst: ExpressionResult,
                                   src: ExpressionResult, node: Node) {
    if (dst.expr instanceof FunctionLookUpResult
        || src.expr instanceof FunctionLookUpResult) {
        throw new InternalError(`unsupport function name`);
    }

    if ( !(dst.type instanceof LeftReferenceType)) {
        throw new InternalError(`you could only bind to a reference`);
    }

    if (!(dst.isLeft) || !(dst.expr instanceof WAddressHolder)) {
        throw new InternalError(`the reference is not a left value`);
    }

    if ( src.type instanceof ReferenceType ) {

        const sr = src.type.elementType;
        const dr = dst.type.elementType;

        if ( sr instanceof ClassType && dr instanceof ClassType) {
            if ( !sr.isSubClassOf(dr) ) {
                throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
            }
        } else {
            if ( !src.type.elementType.equals(dst.type.elementType)) {
                throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
            }
        }

        if (src.expr instanceof WAddressHolder) {
            src.expr = src.expr.createLoad(ctx, src.type);
        }

        ctx.submitStatement(dst.expr.createStore(ctx, PrimitiveTypes.uint32,
            src.expr));
    } else {
        const sr = src.type;
        const dr = dst.type.elementType;

        if ( sr instanceof ClassType && dr instanceof ClassType) {
            if ( !sr.isSubClassOf(dr) ) {
                throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
            }
        } else {
            if ( !src.type.equals(dst.type.elementType)) {
                throw new InternalError(`could not convert from ${src.type} to ${dst.type}`);
            }
        }
        if (!src.isLeft || !(src.expr instanceof WAddressHolder)) {
            throw new InternalError(`you could only bind to a left value`);
        }

        ctx.submitStatement(dst.expr.createStore(ctx, PrimitiveTypes.uint32,
            src.expr.createLoadAddress(ctx)));
    }

}
