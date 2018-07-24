/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 03/07/2018
 */
import {
    Declaration,
    ExpressionResult, FunctionDefinition,
    MemberExpression,
    Node,
    StructOrUnionSpecifier, UnaryExpression,
} from "../common/ast";
import {InternalError, LanguageError, SyntaxError} from "../common/error";
import {
    AddressType,
    ClassField,
    ClassType,
    FunctionType,
    LeftReferenceType,
    PointerType, PrimitiveTypes,
    Type,
    Variable,
} from "../common/type";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doReferenceTransform} from "./conversion";
import {lookupPreviousDeclaration, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {declareFunction, defineFunction, parseFunctionDeclarator} from "./function";

function parseClassDeclartion(ctx: CompileContext, decl: Declaration, buildCtx: ClassBuildContext, node: Node) {
    const baseType = parseTypeFromSpecifiers(ctx, decl.specifiers, node);
    for (const declarator of decl.initDeclarators) {
        if ( declarator.declarator === null) {
            throw new InternalError(`unsupport bit field`);
        } else {
            const [fieldType, fieldName] = parseDeclarator(ctx, declarator.declarator, baseType);

            const lastItem = lookupPreviousDeclaration(ctx, fieldType, fieldName, node);

            if ( lastItem === "pass" ) {
                throw new SyntaxError(`redeclartion of field ${fieldName}`, node);
            }

            if ( lastItem !== "none" ) {
                throw new SyntaxError(`redefinition of field ${fieldName}`, node);
            }

            if (fieldType instanceof FunctionType ) {
                if (!ctx.isCpp()) {
                    throw new LanguageError(`function field is only support in c++`, node);
                }
                if ( fieldType.isStatic ) {
                    declareFunction(ctx, fieldType, fieldName,
                        decl.specifiers.includes("__libcall"), node);
                } else {
                    fieldType.parameterTypes = [buildCtx.classPtrType, ...fieldType.parameterTypes];
                    fieldType.parameterNames = ["this", ...fieldType.parameterNames];
                    fieldType.isMemberFunction = true;
                    declareFunction(ctx, fieldType, fieldName,
                        decl.specifiers.includes("__libcall"), node);
                }
                continue;
            }

            if (fieldName.charAt(0) === "#") {
                throw new SyntaxError(`illegal operator overload`, node);
            }

            if (fieldType.isStatic) {
                if (!ctx.isCpp()) {
                    throw new LanguageError(`static field is only support in c++`, node);
                }
                if (declarator.initializer !== null) {
                    throw new LanguageError(`static field could only be initialize outside`
                        + ` class definition`, node);
                }
                // 类体内的声明不是定义，且可以声明拥有不完整类型（异于 void）的成员，包含该成员的声明所在的类型
                ctx.scopeManager.declare(fieldName, new Variable(
                    fieldName, ctx.scopeManager.getFullName(fieldName), ctx.fileName,
                    fieldType, AddressType.MEMORY_EXTERN, ctx.scopeManager.getFullName(fieldName)   ,
                ), node);
            } else {
                if (declarator.initializer !== null) {
                    if (!ctx.isCpp()) {
                        throw new LanguageError(`field init is only support in c++`, node);
                    }
                    // TODO:: standard field init
                    throw new InternalError(`no impl`);
                }
                buildCtx.fields.push({
                    name: fieldName,
                    type: fieldType,
                    startOffset: buildCtx.curOffset,
                });
                if ( !buildCtx.union ) {
                    buildCtx.curOffset += fieldType.length;
                }
            }
        }
    }
}

interface ClassBuildContext {
    union: boolean;
    classType: ClassType;
    classPtrType: PointerType;
    fields: ClassField[];
    curOffset: number;
}

StructOrUnionSpecifier.prototype.codegen = function(ctx: CompileContext): Type {
    let name = this.identifier.name;
    if ( ! ctx.isCpp() ) {
        name = "$" + name;
    }
    const oldItem = ctx.scopeManager.lookupShortName(name);
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
    ctx.scopeManager.enterScope(name);
    const buildCtx: ClassBuildContext = {
        classType: newItem,
        classPtrType: new PointerType(newItem),
        union: this.union,
        fields: newItem.fields,
        curOffset: 0,
    };
    newItem.isComplete = false;
    const delayParseList: Array<[FunctionDefinition, FunctionType, string]> = [];
    for (const decl of this.declarations) {
        if (decl instanceof Declaration) {
            parseClassDeclartion(ctx, decl, buildCtx, this);
        } else if (decl instanceof FunctionDefinition) {
            // TODO:: constructor
            if (!ctx.isCpp()) {
                throw new LanguageError(`function field is only support in c++`, this);
            }
            const resultType = parseTypeFromSpecifiers(ctx, decl.specifiers, this);
            if (resultType == null) {
                throw new SyntaxError(`illegal return type`, this);
            }
            const functionType = parseFunctionDeclarator(ctx, decl.declarator, resultType);
            if (functionType == null) {
                throw new SyntaxError(`illegal function definition`, this);
            }
            const realName = functionType.name;
            if ( functionType.isStatic ) {
                declareFunction(ctx, functionType, realName,
                    decl.specifiers.includes("__libcall"), this);
            } else {
                functionType.parameterTypes = [buildCtx.classPtrType, ...functionType.parameterTypes];
                functionType.parameterNames = ["this", ...functionType.parameterNames];
                functionType.isMemberFunction = true;
                declareFunction(ctx, functionType, realName,
                    decl.specifiers.includes("__libcall"), this);
            }
            delayParseList.push([decl, functionType, realName]);
        } else {
            throw new InternalError(`StructOrUnionSpecifier()`);
        }
    }
    newItem.buildFieldMap();
    newItem.isComplete = true;
    for (const arr of delayParseList) {
        const [decl, functionType, realName] = arr;
        defineFunction(ctx, functionType, realName,
            decl.body.body, this);
    }
    ctx.scopeManager.exitScope();
    return newItem;
};

MemberExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    let left = this.pointed ?
        new UnaryExpression(this.location, "*", this.object).codegen(ctx)
        : this.object.codegen(ctx);

    left = doReferenceTransform(ctx, left, this);

    if ( !(left.isLeft && left.expr instanceof WAddressHolder)) {
        throw new InternalError(`unsupport rvalue of member expression`);
    }

    if ( !(left.type instanceof ClassType)) {
        throw new SyntaxError(`only struct/class could be get member`, this);
    }

    const item = ctx.scopeManager.lookupFullName(left.type.fullName + "::" + this.member.name);

    if ( item !== null ) {
        if ( item instanceof Type ) {
            throw new SyntaxError(`illegal type member expression`, this);
        } else if (item instanceof Variable) {
            // static field
            return {
                type: item.type,
                expr: new WAddressHolder(item.location, item.addressType, this.location),
                isLeft: true,
            };
        } else {
            item.instance = left.expr;
            item.instanceType = left.type;
            return {
                type: PrimitiveTypes.void,
                expr: item,
                isLeft: false,
            };
        }
    }

    // class field
    const field = left.type.fieldMap.get(this.member.name);
    if ( !field ) {
        throw new SyntaxError(`property ${this.member.name} does not appear on ${left.type.name}`, this);
    }
    return {
        isLeft: true,
        type: field.type,
        expr: left.expr.makeOffset(field.startOffset),
    };
};

export function classes() {
    return "";
}
