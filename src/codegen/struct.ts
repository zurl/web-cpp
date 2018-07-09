/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 03/07/2018
 */
import {
    ExpressionResult,
    ExpressionResultType,
    MemberExpression,
    StructOrUnionSpecifier,
    UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {ClassField, ClassType, LeftReferenceType, ReferenceType, Type} from "../common/type";
import {CompileContext} from "./context";
import {parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {loadReference} from "./stack";

StructOrUnionSpecifier.prototype.codegen = function(ctx: CompileContext): Type {
    if (this.union) {
        throw new InternalError(`unsupport union`);
    }
    const name = this.identifier.name;
    const scopeName = ctx.isCpp() ? name : "$" + name;
    if ( this.declarations === null) {
        // incomplete definition;
        const item = ctx.currentScope.get(scopeName);
        if ( item ) {
            if ( !(item instanceof ClassType) ) {
                throw new SyntaxError(`${item} is not a struct`, this);
            }
            return item;
        } else {
            const newItem = new ClassType(name, [], this.union);
            newItem.isComplete = false;
            ctx.currentScope.set(scopeName, newItem);
            return newItem;
        }
    }
    let type: ClassType;
    if ( ctx.currentScope.hasInCurrentScope(scopeName) ) {
        const item = ctx.currentScope.get(scopeName);
        if ( !(item instanceof ClassType) ) {
            throw new SyntaxError(`${item} is not a struct`, this);
        }
        if ( item.isComplete ) {
            throw new SyntaxError(`redefine struct type name ${scopeName}`, this);
        } else {
            type = item;
        }
    } else {
        type = new ClassType(name, [], this.union);
        ctx.currentScope.set(scopeName, type);
    }
    const fields = type.fields;
    type.isComplete = false;
    let curOffset = 0;
    for (const decl of this.declarations) {
        const baseType = parseTypeFromSpecifiers(ctx, decl.specifierQualifiers, this);
        for (const declarator of decl.declarators) {
            if ( declarator.declarator === null) {
                throw new InternalError(`unsupport bit field`);
            } else {
                const [fieldType, fieldName] = parseDeclarator(ctx, declarator.declarator, baseType);
                if ( this.union ) {
                    fields.push({
                        name: fieldName,
                        type: fieldType,
                        startOffset: 0,
                    });
                } else {
                    fields.push({
                        name: fieldName,
                        type: fieldType,
                        startOffset: curOffset,
                    });
                    curOffset += fieldType.length;
                }
            }
         }
    }
    type.buildFieldMap();
    type.isComplete = true;
    return type;
};

MemberExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const left = this.pointed ?
        new UnaryExpression(this.location, "*", this.object).codegen(ctx)
        : this.object.codegen(ctx);
    let rawType = left.type;
    if ( rawType instanceof LeftReferenceType) {
        rawType = rawType.elementType;
    }
    if ( !(rawType instanceof ClassType)) {
        throw new SyntaxError(`only struct/class could be get member`, this);
    }
    const field = rawType.fieldMap.get(this.member.name);
    if ( !field ) {
        throw new SyntaxError(`property ${this.member.name} does not appear on ${rawType.name}`, this);
    }
    ctx.currentNode = this;
    if ( left.type instanceof LeftReferenceType ) {
        loadReference(ctx, left);
        // 现在stacktop是结构体指针
        // 偏移一下
        if (!rawType.isUnion) {
            ctx.build(OpCode.PUI32, field.startOffset);
            ctx.build(OpCode.ADD);
        }
        return {
            type: new LeftReferenceType(field.type),
            form: ExpressionResultType.RVALUE,
            value: 0,
        };
    } else {
        if ( left.form === ExpressionResultType.LVALUE_MEMORY_EXTERN) {
            return {
                type: field.type,
                value: left.value,
                form: left.form,
                offset: field.startOffset,
            };
        } else if ( left.form === ExpressionResultType.LVALUE_MEMORY_DATA
        || left.form === ExpressionResultType.LVALUE_STACK
        || left.form === ExpressionResultType.LVALUE_MEMORY_BSS) {
            return {
                type: field.type,
                value: left.value as number + field.startOffset,
                form: left.form,
            };
        } else if ( left.form === ExpressionResultType.RVALUE) {
            // ??? why rvalue fuck exist
            throw new SyntaxError(`unsupport form rvalue`, this);
        } else {
            throw new InternalError(`unsupport form`);
        }
    }
};

export function struct() {
    return "";
}
