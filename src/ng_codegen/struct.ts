/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 03/07/2018
 */
import {
    ExpressionResult,
    MemberExpression,
    StructOrUnionSpecifier,
    UnaryExpression,
} from "../common/ast";
import {InternalError, SyntaxError} from "../common/error";
import {ClassType, LeftReferenceType, Type} from "../common/type";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {parseDeclarator, parseTypeFromSpecifiers} from "./declaration";

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

    if ( left.isLeft && left.expr instanceof WAddressHolder) {
        return {
            isLeft: true,
            type: field.type,
            expr: left.expr.makeOffset(field.startOffset),
        };
    } else {
        throw new InternalError(`unsupport rvalue of member expression`);
    }
};

export function struct() {
    return "";
}
