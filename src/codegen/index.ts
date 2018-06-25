/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/06/2018
 */
import {Node} from "../common/ast";
import {CompileContext} from "./context";
import {declaration} from "./declaration";
import {functions} from "./function";
import {statement} from "./statement";
import {expression} from "./expression";
import {expression_type} from "./expression_type";

function loadCodegen() {
    declaration();
    statement();
    functions();
    expression();
    expression_type();
}

loadCodegen();

export function codegen(root: Node, ctx: CompileContext) {
    root.codegen(ctx);
}

