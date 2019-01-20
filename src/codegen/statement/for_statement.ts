import {Node, SourceLocation} from "../../common/node";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WStatement} from "../../wasm/node";
import {WBlock, WBr, WBrIf, WLoop} from "../../wasm/statement";
import {CompileContext} from "../context";
import {doConversion} from "../conversion";
import {Declaration} from "../declaration/declaration";
import {IdentifierDeclarator} from "../declaration/identifier_declarator";
import {InitDeclarator} from "../declaration/init_declartor";
import {SpecifierList} from "../declaration/specifier_list";
import {BinaryExpression} from "../expression/binary_expression";
import {Expression, recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {IntegerConstant} from "../expression/integer_constant";
import {UnaryExpression} from "../expression/unary_expression";
import {CompoundStatement} from "./compound_statement";
import {Statement} from "./statement";
import {triggerAllDestructor} from "../class/destructor";

export class ForStatement extends Statement {
    public init: Expression | Declaration | null;
    public test: Expression | null;
    public update: Expression | null;
    public body: Statement;

    constructor(location: SourceLocation,
                init: Expression | Declaration | null,
                test: Expression | null,
                update: Expression | null,
                body: Statement) {
        super(location);
        this.init = init;
        this.test = test;
        this.update = update;
        this.body = body;
    }

    public codegen(ctx: CompileContext) {
        ctx.enterScope();
        if (this.init !== null) {
            if (this.init instanceof Declaration) {
                this.init.codegen(ctx);
            } else {
                recycleExpressionResult(ctx, this, this.init.codegen(ctx));
            }
        }

        const outerBlockStatements: WStatement[] = [];
        const innerBlockStatements: WStatement[] = [];
        const loopStatements: WStatement[] = [];

        const savedContainer = ctx.getStatementContainer();
        // <-- inner block -->
        ctx.setStatementContainer(innerBlockStatements);
        ctx.currentFuncContext.continueStack.push(ctx.currentFuncContext.blockLevel + 3);
        ctx.currentFuncContext.breakStack.push(ctx.currentFuncContext.blockLevel + 1);
        ctx.currentFuncContext.blockLevel += 3;
        if (this.body instanceof CompoundStatement) {
            this.body.codegen(ctx);
        } else {
            this.body.codegen(ctx);
        }
        ctx.currentFuncContext.blockLevel += 3;
        ctx.currentFuncContext.continueStack.pop();
        ctx.currentFuncContext.breakStack.pop();
        // <-- inner block -->

        // <-- loop -->
        ctx.setStatementContainer(loopStatements);
        if (this.test !== null) {
            const condition = new UnaryExpression(this.location,
                "!", this.test).codegen(ctx);
            condition.expr = doConversion(ctx, PrimitiveTypes.int32, condition, this);
            condition.type = PrimitiveTypes.int32;
            ctx.submitStatement(new WBrIf(1, condition.expr.fold(), this.location));
        }
        ctx.submitStatement(new WBlock(innerBlockStatements, this.location));
        if (this.update !== null) {
            recycleExpressionResult(ctx, this, this.update.codegen(ctx));
        }
        ctx.submitStatement(new WBr(0, this.location));
        // <-- loop -->

        // <-- outer block -->
        ctx.setStatementContainer(outerBlockStatements);
        ctx.submitStatement(new WLoop(loopStatements, this.location));
        // <-- outer block -->
        ctx.exitScope(this);
        ctx.setStatementContainer(savedContainer);
        ctx.submitStatement(new WBlock(outerBlockStatements, this.location));
    }
}

export function getForLoop(sizeExpr: Expression,
                           statements: (idx: Identifier) => Statement[], node: Node): ForStatement {
    const i = Identifier.fromString(node.location, "i");
    return new ForStatement(node.location,
        // i = 0
        new Declaration(node.location, new SpecifierList(node.location, ["int"]), [new InitDeclarator(
            node.location, new IdentifierDeclarator(node.location, i), IntegerConstant.ZeroConstant,
        )]),
        // i < size
        new BinaryExpression(node.location, "<", i, sizeExpr),
        // i ++
        new UnaryExpression(node.location, "++", i),
        new CompoundStatement(node.location, statements(i)));
}
