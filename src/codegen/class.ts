/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 03/07/2018
 */
import {
    AccessControlLabel,
    ClassSpecifier,
    CompoundStatement,
    ConstructorOrDestructorDeclaration, Declaration,
    Expression, ExpressionResult, FunctionDefinition,
    InitializerList,
    MemberExpression, Node,
    ObjectInitializer, UnaryExpression,
} from "../common/ast";
import {InternalError, LanguageError, SyntaxError} from "../common/error";
import {AddressType, Variable} from "../common/symbol";
import {
    AccessControl, getAccessControlFromString, Type,
} from "../type";
import {ClassField, ClassType, Inheritance} from "../type/class_type";
import {PointerType, ReferenceType} from "../type/compound_type";
import {CppFunctionType, FunctionType} from "../type/function_type";
import {PrimitiveTypes} from "../type/primitive_type";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doReferenceTransform} from "./conversion";
import {generateDefaultCtors} from "./cpp/lifecycle";
import {lookupPreviousDeclaration, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {declareFunction, defineFunction, parseFunctionDeclarator} from "./function";
import {FunctionLookUpResult} from "./scope";

function parseClassDeclartion(ctx: CompileContext, decl: Declaration, buildCtx: ClassBuildContext, node: Node) {
    const baseType = parseTypeFromSpecifiers(ctx, decl.specifiers, node);
    for (const declarator of decl.initDeclarators) {
        if (declarator.declarator === null) {
            throw new InternalError(`unsupport bit field`);
        } else {
            const [fieldType, fieldName] = parseDeclarator(ctx, declarator.declarator, baseType);

            const lastItem = lookupPreviousDeclaration(ctx, fieldType, fieldName, node);

            if (lastItem === "pass") {
                throw new SyntaxError(`redeclartion of field ${fieldName}`, node);
            }

            if (lastItem !== "none") {
                throw new SyntaxError(`redefinition of field ${fieldName}`, node);
            }

            if (fieldType instanceof FunctionType) {
                fieldType.name = fieldName;
                if (!ctx.isCpp()) {
                    throw new LanguageError(`function field is only support in c++`, node);
                }
                if (fieldType.isStatic) {
                    declareFunction(ctx, fieldType,
                        decl.specifiers.includes("__libcall"), buildCtx.accessControl, node);
                } else {
                    fieldType.parameterTypes = [buildCtx.classPtrType, ...fieldType.parameterTypes];
                    fieldType.parameterNames = ["this", ...fieldType.parameterNames];
                    fieldType.cppFunctionType = CppFunctionType.MemberFunction;
                    fieldType.referenceClass = buildCtx.classType;
                    if (fieldType.isVirtual) {
                        buildCtx.classType.registerVFunction(ctx, fieldType);
                    } else {
                        if (buildCtx.classType.getVCallInfo(fieldType.toIndexName()) !== null) {
                            fieldType.isVirtual = true;
                            buildCtx.classType.registerVFunction(ctx, fieldType);
                        }
                    }
                    declareFunction(ctx, fieldType,
                        decl.specifiers.includes("__libcall"), buildCtx.accessControl, node);
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
                    fieldType, AddressType.MEMORY_EXTERN, ctx.scopeManager.getFullName(fieldName),
                ), node);
            } else {
                let initializer = null as (Expression | ObjectInitializer | null);
                if (declarator.initializer !== null) {
                    if (!ctx.isCpp()) {
                        throw new LanguageError(`field init is only support in c++`, node);
                    }
                    if (declarator.initializer instanceof InitializerList) {
                        throw new SyntaxError(`unsupport initial list`, node);
                    }
                    initializer = declarator.initializer;
                }
                buildCtx.fields.push({
                    name: fieldName,
                    type: fieldType,
                    startOffset: buildCtx.curOffset,
                    initializer,
                    accessControl: buildCtx.accessControl,
                });
                if (!buildCtx.union) {
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
    accessControl: AccessControl;
}

ClassSpecifier.prototype.codegen = function(ctx: CompileContext): Type {
    let name = this.identifier.name;
    if (!ctx.isCpp()) {
        name = "$" + name;
    }
    const oldItem = ctx.scopeManager.lookupShortName(name);
    if (oldItem !== null) {
        if (this.declarations === null) {
            if (oldItem instanceof ClassType) {
                return oldItem;
            } else {
                throw new SyntaxError(`conflict type of ${name}`, this);
            }
        } else {
            throw new SyntaxError(`redefine of ${name}`, this);
        }
    }
    const inheritance = [] as Inheritance[];
    for (const item of this.inherits) {
        const accessControl = getAccessControlFromString(item.accessControl);
        const classType = ctx.scopeManager.lookupAnyName(item.className.name);
        if (!(classType instanceof ClassType)) {
            throw new SyntaxError(`you could not inherit type ${classType}, which is not a class type`, this);
        }
        if (!classType.isComplete) {
            throw new SyntaxError(`you could not inherit type ${classType}, which is incomplete`, this);
        }
        inheritance.push({
            classType,
            accessControl,
        });
    }

    const newItem = new ClassType(name, ctx.scopeManager.getFullName(name),
        ctx.fileName, [], this.typeName === "union", inheritance);
    if (this.declarations === null) {
        // incomplete definition;
        newItem.isComplete = false;
        ctx.scopeManager.declare(name, newItem, this);
        return newItem;
    }

    // find virtual
    let isVirtual = false;
    for (const decl of this.declarations) {
        if (decl instanceof Declaration || decl instanceof FunctionDefinition) {
            if (decl.specifiers.includes("virtual")) {
                isVirtual = true;
                break;
            }
        } else if ( decl instanceof ConstructorOrDestructorDeclaration) {
            if (decl.isVirtual) {
                isVirtual = true;
                break;
            }
        }
    }
    for (const parent of inheritance) {
        if (parent.classType.requireVPtr) {
            isVirtual = true;
            break;
        }
    }

    if (isVirtual) {
        newItem.setUpVPtr();
    }

    ctx.scopeManager.define(name, newItem, this);
    ctx.scopeManager.enterScope(name);
    const buildCtx: ClassBuildContext = {
        classType: newItem,
        classPtrType: new PointerType(newItem),
        union: this.typeName === "union",
        fields: newItem.fields,
        curOffset: newItem.objectSize,
        accessControl: this.typeName === "struct" ?
            AccessControl.Public : AccessControl.Private,
    };
    newItem.isComplete = false;
    const delayParseList: Array<[CompoundStatement, FunctionType]> = [];

    for (const decl of this.declarations) {
        if (decl instanceof Declaration) {
            parseClassDeclartion(ctx, decl, buildCtx, this);
        } else if (decl instanceof ConstructorOrDestructorDeclaration) {
            if (decl.name.name !== name) {
                throw new SyntaxError(`invaild ctor/dtor name ${decl.name.name}`, this);
            }
            let funcType: FunctionType;
            if (decl.isCtor) {
                const parameterTypes: Type[] = [new PointerType(newItem)], parameterNames: string[] = ["this"];
                if (decl.param !== null) {
                    const {types, names} = decl.param!.codegen(ctx);
                    parameterTypes.push(...types);
                    parameterNames.push(...names);
                }
                funcType = new FunctionType("#" + name, PrimitiveTypes.void, parameterTypes, parameterNames, false);
                funcType.cppFunctionType = CppFunctionType.Constructor;
                funcType.referenceClass = newItem;
                funcType.initList = decl.initList!;
            } else {
                funcType = new FunctionType("~" + name, PrimitiveTypes.void,
                    [new PointerType(newItem)], ["this"], false);
                funcType.cppFunctionType = CppFunctionType.Destructor;
                funcType.referenceClass = newItem;
                if (decl.isVirtual) {
                    funcType.isVirtual = true;
                    buildCtx.classType.registerVFunction(ctx, funcType);
                } else {
                    if (buildCtx.classType.getVCallInfo(funcType.toIndexName()) !== null) {
                        funcType.isVirtual = true;
                        buildCtx.classType.registerVFunction(ctx, funcType);
                    }
                }
            }
            if (decl.body !== null) {
                delayParseList.push([decl.body, funcType]);
            } else {
                declareFunction(ctx, funcType, false, buildCtx.accessControl, this);
            }
        } else if (decl instanceof FunctionDefinition) {
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
            if (functionType.isStatic) {
                declareFunction(ctx, functionType,
                    decl.specifiers.includes("__libcall"), buildCtx.accessControl, this);
            } else {
                functionType.parameterTypes = [buildCtx.classPtrType, ...functionType.parameterTypes];
                functionType.parameterNames = ["this", ...functionType.parameterNames];
                functionType.cppFunctionType = CppFunctionType.MemberFunction;
                functionType.referenceClass = newItem;
                if (functionType.isVirtual) {
                    newItem.registerVFunction(ctx, functionType);
                } else {
                    if (newItem.getVCallInfo(functionType.toIndexName()) !== null) {
                        functionType.isVirtual = true;
                        buildCtx.classType.registerVFunction(ctx, functionType);
                    }
                }
                declareFunction(ctx, functionType,
                    decl.specifiers.includes("__libcall"), buildCtx.accessControl, this);
            }
            delayParseList.push([decl.body, functionType]);
        } else if (decl instanceof AccessControlLabel) {
            buildCtx.accessControl = getAccessControlFromString(decl.label);
        } else {
            throw new InternalError(`StructOrUnionSpecifier()`);
        }
    }
    if (newItem.requireVPtr) {
        newItem.generateVTable(ctx, this);
    }
    newItem.initialize();
    newItem.isComplete = true;
    for (const arr of delayParseList) {
        const [body, functionType] = arr;
        defineFunction(ctx, functionType,
            body.body, AccessControl.Public, this);
    }
    generateDefaultCtors(ctx, newItem, this);
    ctx.scopeManager.exitScope();
    return newItem;
};

MemberExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    let left = this.pointed ?
        new UnaryExpression(this.location, "*", this.object).codegen(ctx)
        : this.object.codegen(ctx);

    const isRef = left.type instanceof ReferenceType;

    left = doReferenceTransform(ctx, left, this);

    if (!(left.isLeft && left.expr instanceof WAddressHolder)) {
        throw new InternalError(`unsupport rvalue of member expression`);
    }

    if (!(left.type instanceof ClassType)) {
        throw new SyntaxError(`only struct/class could be get member`, this);
    }

    const item = left.type.getMember(ctx, this.member.name);

    if ( item === null ) {
        throw new SyntaxError(`name ${this.member.name} is not on class ${left.type.name}`, this);
    } else if (item instanceof Variable) {
        // static field
        return {
            type: item.type,
            expr: new WAddressHolder(item.location, item.addressType, this.location),
            isLeft: true,
        };
    } else if (item instanceof FunctionLookUpResult) {
        item.instance = left.expr;
        item.instanceType = left.type;
        if (this.pointed || isRef) {
            if ( this.member.name.includes("~") ) {
                item.isDynamicCall = this.forceDynamic;
            } else {
                item.isDynamicCall = true;
            }
        }
        return {
            type: PrimitiveTypes.void,
            expr: item,
            isLeft: false,
        };
    } else {
        return {
            isLeft: true,
            type: item.type,
            expr: left.expr.makeOffset(item.startOffset),
        };
    }
};

export function classes() {
    return "";
}
