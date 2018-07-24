/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {Node} from "../common/ast";
import {FunctionType, PointerType, PrimitiveTypes} from "../common/type";
import {classes} from "./class";
import {CompileContext} from "./context";
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
}

loadCodegen();

export function codegen(root: Node, ctx: CompileContext) {
    const voidPtrT = new PointerType(PrimitiveTypes.void);
    // c++ runtime require memcpy
    declareFunction(ctx, new FunctionType("memcpy",
        PrimitiveTypes.int32, [voidPtrT, voidPtrT, PrimitiveTypes.int32],
        ["dst", "src", "size"], false), "memcpy",
        true, root);
    root.codegen(ctx);
}
