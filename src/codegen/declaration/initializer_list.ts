import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ArrayType} from "../../type/compound_type";
import {CompileContext} from "../context";
import {AssignmentExpression} from "../expression/assignment_expression";
import {Expression} from "../expression/expression";
import {IntegerConstant} from "../expression/integer_constant";
import {SubscriptExpression} from "../expression/subscript_expression";
import {ExpressionStatement} from "../statement/expression_statement";

export class InitializerList extends Node {
    public items: InitializerListItem[];

    constructor(location: SourceLocation, items: InitializerListItem[]) {
        super(location);
        this.items = items;
    }

    public initialize(ctx: CompileContext, node: Expression, type: Type) {
        if ( !(type instanceof ArrayType )) {
            throw new InternalError("InitializerList not support");
        }
        this.initializeArray(ctx, node, type);
    }

    public initializeArray(ctx: CompileContext, node: Expression, type: ArrayType) {
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if ( item.initializer instanceof Expression ) {
                new ExpressionStatement(this.location,
                    new AssignmentExpression(this.location, "=",
                        new SubscriptExpression(this.location,
                            node,
                            IntegerConstant.fromNumber(this.location, i)),
                        item.initializer)).codegen(ctx);
            } else {
                if (!(type.elementType instanceof ArrayType) ) {
                    throw new SyntaxError(`illegal inner initializer list`, node);
                }
                item.initializer.initializeArray(ctx,
                    new SubscriptExpression(node.location,
                        node,
                        IntegerConstant.fromNumber(node.location, i)), type.elementType);
            }
        }
    }
}

export class InitializerListItem extends Node {
    public initializer: Expression | InitializerList;

    constructor(location: SourceLocation, initializer: Expression | InitializerList) {
        super(location);
        this.initializer = initializer;
    }
}
