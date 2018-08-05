/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 21/07/2018
 */
import {ExpressionResult, Node} from "../../common/ast";
import {InternalError} from "../../common/error";
import {LeftReferenceType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
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

    if ( !(src.type.equals(dst.type.elementType)) ) {
        throw new InternalError(`reference type mismatch`);
    }

    if ( !src.isLeft || !(src.expr instanceof WAddressHolder)) {
        throw new InternalError(`you could only bind to a left value`);
    }

    if ( !(dst.isLeft) || !(dst.expr instanceof WAddressHolder)) {
        throw new InternalError(`the reference is not a left value`);
    }

    ctx.submitStatement(dst.expr.createStore(ctx, PrimitiveTypes.uint32,
        src.expr.createLoadAddress(ctx)));

}
