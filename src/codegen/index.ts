/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {Node} from "../common/node";
import {AccessControl, Type} from "../type";
import {PointerType} from "../type/compound_type";
import {FunctionType} from "../type/function_type";
import {PrimitiveTypes} from "../type/primitive_type";
import {CompileContext} from "./context";
import {TranslationUnit} from "./declaration/translation_unit";
import {declareFunction} from "./function/function";

function declareSystemFunction(ctx: CompileContext, name: string, returnType: Type,
                               parameterType: Type[], node: Node) {
    declareFunction(ctx, {
        name,
        functionType: new FunctionType(returnType, parameterType, false),
        parameterInits: parameterType.map((x) => null),
        parameterNames: parameterType.map((x) => ""),
        accessControl: AccessControl.Public,
        isLibCall: true,
    }, node);
}

export function codegen(root: TranslationUnit, ctx: CompileContext) {
    const voidT = PrimitiveTypes.void;
    const voidPtrT = new PointerType(PrimitiveTypes.void);
    // c++ runtime require memcpy & malloc & free & malloc_array
    if ( ctx.isCpp() ) {
        declareSystemFunction(ctx, "memcpy", voidT, [voidPtrT, voidPtrT, PrimitiveTypes.uint32], root);
        declareSystemFunction(ctx, "memset", voidT, [voidPtrT, PrimitiveTypes.int32, PrimitiveTypes.uint32], root);
        declareSystemFunction(ctx, "malloc", voidPtrT, [PrimitiveTypes.uint32], root);
        declareSystemFunction(ctx, "malloc_array", voidPtrT, [PrimitiveTypes.uint32, PrimitiveTypes.uint32], root);
        declareSystemFunction(ctx, "free", voidT, [voidPtrT], root);
    }
    root.codegen(ctx);
}
