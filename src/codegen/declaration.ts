/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {
    AbstractArrayDeclarator,
    AbstractDeclarator, AbstractFunctionDeclarator, AbstractPointerDeclarator,
    ArrayDeclarator,
    AssignmentExpression,
    Declaration,
    Declarator,
    EnumSpecifier,
    FunctionDeclarator,
    Identifier,
    IdentifierDeclarator,
    InitializerList,
    Node,
    ParameterList,
    Pointer,
    PointerDeclarator,
    SpecifierType,
    StructOrUnionSpecifier,
    TranslationUnit,
    TypedefName,
} from "../common/ast";
import {assertType, InternalError, SyntaxError} from "../common/error";
import {
    AddressType,
    ArrayType,
    ClassType,
    FunctionType,
    IntegerType, PointerType,
    PrimitiveTypes, Type, Variable,
} from "../common/type";
import {FunctionEntity} from "../common/type";
import {getPrimitiveTypeFromSpecifiers, isTypeQualifier, isTypeSpecifier} from "../common/utils";
import {WConst, WType} from "../wasm";
import {WExpression} from "../wasm/node";
import {WFunctionType} from "../wasm/section";
import {CompileContext} from "./context";

export function parseTypeFromSpecifiers(ctx: CompileContext, specifiers: SpecifierType[], nodeForError: Node): Type {
    let resultType: Type | null = null;
    const typeNodes = specifiers.filter((x) => typeof(x) !== "string");
    const stringNodes = specifiers.filter((x) => typeof(x) === "string") as string[];
    if (typeNodes.length !== 0) {
        if ( typeNodes.length !== 1) {
            throw new SyntaxError(`illegal syntax`, nodeForError);
        }
        const node = typeNodes[0];
        if ( node instanceof StructOrUnionSpecifier) {
            resultType = node.codegen(ctx) as Type;
        } else if ( node instanceof TypedefName) {
            resultType = node.codegen(ctx) as Type;
        } else if ( node instanceof EnumSpecifier) {
            resultType = node.codegen(ctx) as Type;
        } else {
            throw new InternalError(`unsupport type`);
        }
        // complex types
        // TODO::
    } else {
        // primitive types
        const typeNames = stringNodes.filter(isTypeSpecifier).sort();
        resultType = getPrimitiveTypeFromSpecifiers(typeNames);
    }
    if (resultType == null) {
        throw new SyntaxError("Illegal Return Type", nodeForError);
    }
    if (stringNodes.indexOf("const") !== -1) {
        resultType.isConst = true;
    }
    if (stringNodes.indexOf("extern") !== -1) {
        resultType.isExtern = true;
    }
    if (stringNodes.indexOf("static") !== -1) {
        resultType.isStatic = true;
    }
    return resultType;
}

export function parseDeclarator(ctx: CompileContext, node: Declarator, resultType: Type): [Type, string] {
    if (node === null) {
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

export function mergeTypeWithDeclarator(ctx: CompileContext, type: Type,
                                        declarator: Declarator | AbstractDeclarator): Type {
    if (declarator instanceof FunctionDeclarator || declarator instanceof AbstractFunctionDeclarator) {
        assertType(declarator.parameters, ParameterList);
        const [parameterTypes, parameterNames, variableArguments]
            = (declarator.parameters as ParameterList).codegen(ctx);
        return new FunctionType("", type, parameterTypes, parameterNames, variableArguments);
    } else if (declarator instanceof PointerDeclarator || declarator instanceof AbstractPointerDeclarator) {
        let pointer = declarator.pointer as Pointer | null;
        let result = type;
        while (pointer != null) {
            result = new PointerType(result);
            pointer = pointer.pointer;
        }
        return result;
    } else if (declarator instanceof ArrayDeclarator || declarator instanceof AbstractArrayDeclarator) {
        const length = declarator.length.codegen(ctx);
        if (!(length.expr instanceof WExpression)) {
            throw new SyntaxError("illegal length type", declarator);
        }
        length.expr = length.expr.fold();
        if (!(length.expr instanceof WConst)) {
            throw new SyntaxError("var length array is not support currently", declarator);
        }
        if (!(length.type instanceof IntegerType)) {
            throw new SyntaxError("length of array must be integer", declarator);
        }
        if (declarator.qualifiers.length !== 0) {
            ctx.raiseWarning("unsupport array qualifier");
        }
        return new ArrayType(type, parseInt(length.expr.constant));
    } else {
        throw new SyntaxError("UnsupportDeclaratorType:" + declarator.constructor.name,
            declarator);
    }
}

TranslationUnit.prototype.codegen = function(ctx: CompileContext) {
    this.body.map((item) => item.codegen(ctx));
};

Declaration.prototype.codegen = function(ctx: CompileContext) {
    const baseType = parseTypeFromSpecifiers(ctx, this.specifiers, this);
    const isTypedef = this.specifiers.includes("typedef");
    for (const declarator of this.initDeclarators) {
        const [type, name] = parseDeclarator(ctx, declarator.declarator, baseType);
        if ( isTypedef ) {
            ctx.scopeManager.declare(name, type, this);
            continue;
        }
        if ( type instanceof ClassType && !type.isComplete) {
            throw new SyntaxError(`cannot instancelize incomplete type`, this);
        }
        let storageType = AddressType.STACK;
        let location: number | string = 0;
        if (ctx.scopeManager.isRoot() || type.isStatic) {
            if (type.isExtern) {
                storageType = AddressType.MEMORY_EXTERN;
                location = ctx.scopeManager.getFullName(name);
            } else if (declarator.initializer !== null) {
                storageType = AddressType.MEMORY_DATA;
                location = ctx.memory.allocData(type.length);
            } else {
                storageType = AddressType.MEMORY_BSS;
                location = ctx.memory.allocBss(type.length);
            }
        } else {
            if (type.isExtern) {
                throw new SyntaxError("local variable could not be extern:  " + name, this);
            }
            // TODO:: support static function variable;
            storageType = AddressType.STACK;
            location = ctx.memory.allocStack(type.length);
        }

        if ( type instanceof FunctionType) {
            type.name = name;
            const realName = type.name + type.toMangledName();
            const fullName = ctx.scopeManager.getFullName(realName);
            const entity = new FunctionEntity(realName, fullName, ctx.fileName, type, false, false);
            if ( this.specifiers.includes("__libcall") ) {
                entity.isLibCall = true;
                entity.name = type.name;
                entity.fullName = ctx.scopeManager.getFullName(type.name); // libcall no overload
                const returnTypes: WType[]  = [];
                const parametersTypes: WType[] = [];
                if ( !entity.type.returnType.equals(PrimitiveTypes.void)) {
                    returnTypes.push(entity.type.returnType.toWType());
                }
                entity.type.parameterTypes.map((t) => parametersTypes.push(t.toWType()));
                ctx.imports.push({
                    name: entity.fullName,
                    type: new WFunctionType(returnTypes, parametersTypes),
                });
            }
            ctx.scopeManager.declare(name, entity, this);
            return;
        }

        ctx.scopeManager.declare(name, new Variable(
            name, ctx.scopeManager.getFullName(name), ctx.fileName,
            type, storageType, location,
        ), this);

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

export function parseAbstractDeclarator(ctx: CompileContext, node: AbstractDeclarator, resultType: Type): Type {
    if (node.declarator === null) {
        return mergeTypeWithDeclarator(ctx, resultType, node);
    } else {
        const newResultType = mergeTypeWithDeclarator(ctx, resultType, node);
        return parseAbstractDeclarator(ctx, node.declarator, newResultType);
    }
}

TypedefName.prototype.codegen = function(ctx: CompileContext) {
    const item = this.identifier.name.slice(0, 2) === "::" ?
        ctx.scopeManager.lookupFullName(this.identifier.name) :
        ctx.scopeManager.lookup(this.identifier.name);
    if ( item && item instanceof Type) {
        return item;
    }
    throw new SyntaxError(`${this.identifier.name} is not a type`, this);
};

EnumSpecifier.prototype.codegen = function(ctx: CompileContext) {
    if ( this.enumerators != null ) {
        let now = -1, val = 0;
        for (const enumerator of this.enumerators) {
            now ++;
            if (enumerator.value === null) {
                val = now;
            } else {
                const expr = enumerator.value.codegen(ctx);
                if (!(expr.expr instanceof WExpression)) {
                    throw new SyntaxError("illegal enumrator type", this);
                }
                expr.expr = expr.expr.fold();
                if ( !(expr.expr instanceof WConst) ||
                    !(expr.type instanceof IntegerType) ) {
                    throw new SyntaxError(`enum value must be integer`, this);
                }
                val = parseInt(expr.expr.constant);
            }
            ctx.scopeManager.declare(enumerator.identifier.name, new Variable(
                enumerator.identifier.name, ctx.scopeManager.getFullName(enumerator.identifier.name),
                ctx.fileName, PrimitiveTypes.int32,
                AddressType.CONSTANT, val,
            ), this);
        }
    }
    if ( this.identifier != null ) {
        ctx.scopeManager.declare(this.identifier.name, PrimitiveTypes.int32, this);
    }
    return PrimitiveTypes.int32;
};

export function declaration() {
    return;
}
