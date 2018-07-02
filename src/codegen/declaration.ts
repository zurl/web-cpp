/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import * as Long from "long";
import {
    ArrayDeclarator, AssignmentExpression,
    Declaration,
    Declarator,
    ExpressionResultType,
    FunctionDeclarator, Identifier, IdentifierDeclarator, InitializerList,
    Node,
    ParameterList, Pointer, PointerDeclarator, SpecifierType, TranslationUnit,
} from "../common/ast";
import {assertType, InternalError, SyntaxError} from "../common/error";
import {
    ArrayType,
    ClassType,
    extractRealType,
    FunctionType,
    IntegerType,
    PointerType,
    QualifiedType,
    Type,
} from "../common/type";
import {getPrimitiveTypeFromSpecifiers, isTypeQualifier, isTypeSpecifier} from "../common/utils";
import {CompileContext} from "./context";
import {FunctionEntity, Variable, VariableStorageType} from "./scope";
import {convertTypeOnStack, loadIntoStack, popFromStack} from "./stack";

export function parseTypeFromSpecifiers(specifiers: SpecifierType[], nodeForError: Node): Type {
    let resultType: Type | null = null;
    const typeNodes = specifiers.filter((x) => typeof(x) !== "string");
    const stringNodes = specifiers.filter((x) => typeof(x) === "string") as string[];
    if (typeNodes.length !== 0) {
        // complex types
        // TODO::
        throw new InternalError(`unsupport type`);
    } else {
        // primitive types
        const typeNames = stringNodes.filter(isTypeSpecifier).sort();
        resultType = getPrimitiveTypeFromSpecifiers(typeNames);
    }
    if (resultType == null) {
        throw new SyntaxError("Illegal Return Type", nodeForError);
    }
    const qualifiers = stringNodes.filter(isTypeQualifier).sort();
    if (qualifiers.length !== 0) {
        resultType = new QualifiedType(resultType,
            qualifiers.indexOf("const") !== -1,
            qualifiers.indexOf("volatile") !== -1);
    }
    if (stringNodes.indexOf("extern") !== -1) {
        resultType.isExtern = true;
    }
    return resultType;
}

export function parseDeclarator(ctx: CompileContext, node: Declarator,
                                resultType: Type): [Type, string] {
    if (node == null) {
        return [resultType, ""];
    } else if (node instanceof IdentifierDeclarator) {
        return [resultType, node.identifier.name];
    } else if (node.declarator != null) {
        const newResultType = mergeTypeWithDeclarator(ctx, resultType, node);
        return parseDeclarator(ctx, node.declarator, newResultType);
    } else {
        throw new SyntaxError("UnsupportNodeType:" + node.constructor.name, node);
    }
}

export function mergeTypeWithDeclarator(ctx: CompileContext, type: Type, declarator: Declarator): Type {
    if (declarator instanceof FunctionDeclarator) {
        assertType(declarator.parameters, ParameterList);
        const [parameterTypes, parameterNames] = (declarator.parameters as ParameterList).codegen(ctx);
        return new FunctionType("", type, parameterTypes, parameterNames);
    } else if (declarator instanceof PointerDeclarator) {
        let pointer = declarator.pointer as Pointer | null;
        let result = type;
        while (pointer != null) {
            result = new PointerType(result);
            pointer = pointer.pointer;
        }
        return result;
    } else if (declarator instanceof ArrayDeclarator) {
        const length = declarator.length.codegen(ctx);
        if (length.form !== ExpressionResultType.CONSTANT) {
            throw new SyntaxError("var length array is not support currently", declarator);
        }
        if (!(length.type instanceof IntegerType)) {
            throw new SyntaxError("length of array must be integer", declarator);
        }
        if (declarator.qualifiers.length !== 0) {
            ctx.raiseWarning("unsupport array qualifier");
        }
        return new ArrayType(type, (length.value as Long).toNumber());
    } else {
        throw new SyntaxError("UnsupportDeclaratorType:" + declarator.constructor.name,
            declarator);
    }
}

TranslationUnit.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    this.body.map((item) => item.codegen(ctx));
};

Declaration.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    const baseType = parseTypeFromSpecifiers(this.specifiers, this);
    for (const declarator of this.initDeclarators) {
        const [type, name] = parseDeclarator(ctx, declarator.declarator, baseType);
        if (ctx.currentScope.getInCurrentScope(name) != null) {
            throw new SyntaxError("Redeclaration of name " + name, this);
        }
        let storageType = VariableStorageType.STACK;
        let location: number | string = 0;
        if (ctx.currentScope.isRoot) {
            if (type.isExtern) {
                storageType = VariableStorageType.MEMORY_EXTERN;
                location = ctx.currentScope.getScopeName() + "@" + name;
            } else if (declarator.initializer != null) {
                storageType = VariableStorageType.MEMORY_DATA;
                location = ctx.memory.allocData(type.length);
            } else {
                storageType = VariableStorageType.MEMORY_BSS;
                location = ctx.memory.allocBSS(type.length);
            }
        } else {
            if (type instanceof QualifiedType && type.isExtern) {
                throw new SyntaxError("local variable could not be extern:  " + name, this);
            }
            // TODO:: support static function variable;
            storageType = VariableStorageType.STACK;
            location = ctx.memory.allocStack(type.length);
        }

        if ( type instanceof FunctionType) {
            type.name = name;
            const entity = new FunctionEntity(type.name, ctx.fileName,
                ctx.currentScope.getScopeName() + "@" + type.name, type);
            if ( this.specifiers.includes("__libcall") ) {
                entity.isLibCall = true;
            }
            ctx.currentScope.set(name, entity);
            return;
        }

        ctx.currentScope.set(name, new Variable(
            name, ctx.fileName, type, storageType, location,
        ));

        if (declarator.initializer != null) {
            if ( declarator.initializer instanceof InitializerList ) {
                throw new InternalError("InitializerList not support");
            }
            const expr = new AssignmentExpression(this.location, "=",
                new Identifier(this.location, name),
                declarator.initializer);
            expr.isInitExpr = true;
            expr.codegen(ctx);
        }
    }
};

export function declaration() {
    return;
}
