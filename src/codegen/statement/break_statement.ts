import {SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {WBr} from "../../wasm";
import {CompileContext} from "../context";
import {Statement} from "./statement";

export class BreakStatement extends Statement {
    constructor(location: SourceLocation) {
        super(location);
    }

    public codegen(ctx: CompileContext): void {
        if (ctx.currentFuncContext.breakStack.length === 0) {
            throw new SyntaxError(`break is not in while/do-while/for`, this);
        }
        const item = ctx.currentFuncContext.breakStack[ctx.currentFuncContext.breakStack.length - 1];
        ctx.submitStatement(new WBr(ctx.currentFuncContext.blockLevel - item, this.location));
    }
}
