/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {Node} from "../common/ast";
import {classes} from "./class";
import {CompileContext} from "./context";
import {declaration} from "./declaration";
import {expression} from "./expression";
import {expression_type} from "./expression_type";
import {functions} from "./function";
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
    root.codegen(ctx);
}
