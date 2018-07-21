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
    let name = this.identifier.name;
    if ( ! ctx.isCpp() ) {
        name = "$" + name;
    }
    const oldItem = ctx.scopeManager.lookup(name);
    if ( oldItem !== null ) {
        if ( this.declarations === null ) {
            if ( oldItem instanceof ClassType ) {
                return oldItem;
            } else {
                throw new SyntaxError(`conflict type of ${name}`, this);
            }
        } else {
            throw new SyntaxError(`redefine of ${name}`, this);
        }
    }
    const newItem = new ClassType(name, ctx.scopeManager.getFullName(name), ctx.fileName, [], this.union);
    if ( this.declarations === null) {
        // incomplete definition;
        newItem.isComplete = false;
        ctx.scopeManager.declare(name, newItem, this);
        return newItem;
    }
    ctx.scopeManager.define(name, newItem, this);
    const fields = newItem.fields;
    newItem.isComplete = false;
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
    newItem.buildFieldMap();
    newItem.isComplete = true;
    return newItem;
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
