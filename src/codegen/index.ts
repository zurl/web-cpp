/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {Node} from "../common/ast";
import {AccessControl} from "../type";
import {PointerType} from "../type/compound_type";
import {FunctionType} from "../type/function_type";
import {PrimitiveTypes} from "../type/primitive_type";
import {classes} from "./class";
import {CompileContext} from "./context";
import {executeDeferFunctionTemplateInstantiation, template} from "./cpp/template";
import {declaration} from "./declaration";
import {expression} from "./expression";
import {expression_type} from "./expression_type";
import {declareFunction, functions} from "./function";
import {statement} from "./statement";

function loadCodegen() {
    declaration();
    statement();
    functions();
    expression();
    expression_type();
    classes();
    template();
}

loadCodegen();

export function codegen(root: Node, ctx: CompileContext) {
    const voidPtrT = new PointerType(PrimitiveTypes.void);
    // c++ runtime require memcpy & malloc & free & malloc_array
    if ( ctx.isCpp() ) {
        declareFunction(ctx, new FunctionType("memcpy",
            PrimitiveTypes.void, [voidPtrT, voidPtrT, PrimitiveTypes.uint32],
            ["dst", "src", "size"], false),
            true, AccessControl.Public, root);
        declareFunction(ctx, new FunctionType("memset",
            PrimitiveTypes.void, [voidPtrT, PrimitiveTypes.int32, PrimitiveTypes.uint32],
            ["dst", "ch", "size"], false),
            true, AccessControl.Public, root);
        declareFunction(ctx, new FunctionType("malloc",
            new PointerType(PrimitiveTypes.void), [PrimitiveTypes.uint32],
            ["size"], false),
            true, AccessControl.Public, root);
        declareFunction(ctx, new FunctionType("malloc_array",
            new PointerType(PrimitiveTypes.void), [PrimitiveTypes.uint32, PrimitiveTypes.uint32],
            ["element_size", "length"], false),
            true, AccessControl.Public, root);
        declareFunction(ctx, new FunctionType("free",
            PrimitiveTypes.void, [voidPtrT],
            ["ptr"], false),
            true, AccessControl.Public, root);
    }
    root.codegen(ctx);
    if (ctx.isCpp()) {
        executeDeferFunctionTemplateInstantiation(ctx);
    }
}
