import {LanguageError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {CompileContext} from "../context";
import {ArrayDeclarator} from "../declaration/array_declarator";
import {AnonymousExpression} from "../expression/anonymous_expression";
import {AssignmentExpression} from "../expression/assignment_expression";
import {BinaryExpression} from "../expression/binary_expression";
import {Expression, ExpressionResult, recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {IntegerConstant} from "../expression/integer_constant";
import {CallExpression} from "../function/call_expression";
import {ExpressionStatement} from "../statement/expression_statement";
import {getForLoop} from "../statement/for_statement";
import {TypeName} from "./type_name";

export class NewExpression extends Expression {
    public name: TypeName;
    public arguments: Expression[];
    public placement: Expression | null;
    public arraySize: Expression | null;

    constructor(location: SourceLocation, name: TypeName,
                arguments_: Expression[], placement: Expression | null) {
        super(location);
        this.name = name;
        this.arguments = arguments_;
        this.placement = placement;
        this.arraySize = null;
        // do array transform
        if (this.name.declarator instanceof ArrayDeclarator) {
            this.arraySize = this.name.declarator.length;
            this.name.declarator = null;
        }
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        if ( !ctx.isCpp() ) {
            throw new LanguageError(`new is noly support in c++`, this);
        }
        const ptrType = this.deduceType(ctx);
        if (!(ptrType instanceof PointerType)) {
            throw new SyntaxError(`new must be pointer`, this);
        }
        const itemType = ptrType.elementType;
        const [ptrVarName] = ctx.allocTmpVar(ptrType, this);
        if ( this.arraySize !== null ) {
            const [sizeVarName] = ctx.allocTmpVar(PrimitiveTypes.int32, this);

            const sizeExpr = IntegerConstant.fromNumber(this.location, itemType.length);

            // size = sizeof(Type) * SizeExpression
            const assignSizeExpr = new AssignmentExpression(this.location, "=",
                Identifier.fromString(this.location, sizeVarName), this.arraySize).codegen(ctx);
            recycleExpressionResult(ctx, this, assignSizeExpr);

            // headPtr = (int *) malloc(size + 4)
            const mallocExpr = new CallExpression(this.location, Identifier.fromString(this.location, "::malloc_array"),
                [
                    sizeExpr,
                    Identifier.fromString(this.location, sizeVarName),
                ]).codegen(ctx);
            mallocExpr.type = ptrType;

            const assignExpr = new AssignmentExpression(this.location, "=",
                Identifier.fromString(this.location, ptrVarName),
                new AnonymousExpression(this.location, mallocExpr)).codegen(ctx);
            recycleExpressionResult(ctx, this, assignExpr);
            // for(int i = 0; i < size; i++ )
            if (itemType instanceof ClassType) {
                const ctorName = itemType.fullName + "::#" + itemType.shortName;
                const callee = Identifier.fromString(this.location, ctorName);
                getForLoop(Identifier.fromString(this.location, sizeVarName), (i) => ([
                    new ExpressionStatement(this.location,
                        new CallExpression(this.location, callee, [
                            new BinaryExpression(this.location, "+",
                                Identifier.fromString(this.location, ptrVarName),
                                i)]))]), this).codegen(ctx);
            }
        } else {
            const mallocExpr = new CallExpression(this.location, Identifier.fromString(this.location, "::malloc"),
                [IntegerConstant.fromNumber(this.location, itemType.length)]).codegen(ctx);
            mallocExpr.type = ptrType;
            const assignExpr = new AssignmentExpression(this.location, "=",
                Identifier.fromString(this.location, ptrVarName),
                new AnonymousExpression(this.location, mallocExpr)).codegen(ctx);
            recycleExpressionResult(ctx, this, assignExpr);
            if (itemType instanceof ClassType) {
                const ctorName = itemType.fullName + "::#" + itemType.shortName;
                const callee = Identifier.fromString(this.location, ctorName);
                const ctorExpr = new CallExpression(this.location, callee, [
                    Identifier.fromString(this.location, ptrVarName), ...this.arguments]).codegen(ctx);
                recycleExpressionResult(ctx, this, ctorExpr);
            }
        }
        return Identifier.fromString(this.location, ptrVarName).codegen(ctx);
    }

    public deduceType(ctx: CompileContext): Type {
        return new PointerType(this.name.deduceType(ctx));
    }

}
