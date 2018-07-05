/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {
    CallExpression,
    Declarator, ExpressionResult, ExpressionResultType,
    FunctionDeclarator,
    FunctionDefinition,
    IdentifierDeclarator,
    ParameterList,
} from "../common/ast";
import {assertType, InternalError, SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {
    extractRealType,
    FunctionType,
    PointerType,
    QualifiedType,
    Type,
    Variable,
    VariableStorageType,
} from "../common/type";
import {FunctionEntity} from "../common/type";
import {CompileContext} from "./context";
import {mergeTypeWithDeclarator, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {convertTypeOnStack, loadFromMemory, loadIntoStack} from "./stack";

function parseFunctionDeclarator(ctx: CompileContext, node: Declarator,
                                 resultType: Type): FunctionType {
    if (node instanceof FunctionDeclarator && node.declarator instanceof IdentifierDeclarator) {
        assertType(node.parameters, ParameterList);
        const [parameterTypes, parameterNames] = (node.parameters as ParameterList).codegen(ctx);
        return new FunctionType(node.declarator.identifier.name, resultType, parameterTypes, parameterNames);
    } else if (node.declarator != null) {
        const newResultType = mergeTypeWithDeclarator(ctx, resultType, node);
        return parseFunctionDeclarator(ctx, node.declarator, newResultType);
    } else {
        throw new SyntaxError("UnsupportNodeType:" + node.constructor.name, node);
    }
}

ParameterList.prototype.codegen = function(ctx: CompileContext): [Type[], string[]] {
    ctx.currentNode = this;
    // TODO:: deal with abstract Declarator
    const parameters = this.parameters.map((parameter) =>
        parseDeclarator(ctx, parameter.declarator as Declarator,
            parseTypeFromSpecifiers(ctx, parameter.specifiers, this)));
    const parameterTypes = parameters.map((x) => x[0]);
    const parameterNames = parameters.map((x) => x[1]);
    return [parameterTypes, parameterNames];
};

/**
 * __cdecl call standard
 *  bp - 4 => local_var 1
 *  bp + 0 => saved_ebp
 *  bp + 4 => return_addr
 *  bp + 8 => arg1
 *  bp + ..=> arg2
 * @param {CompileContext} ctx
 */
FunctionDefinition.prototype.codegen = function(ctx: CompileContext) {
    ctx.currentNode = this;
    const resultType = parseTypeFromSpecifiers(ctx, this.specifiers, this);
    if (resultType == null) {
        throw new SyntaxError(`illegal return type`, this);
    }
    const functionType = parseFunctionDeclarator(ctx, this.declarator, resultType);
    if (functionType == null) {
        throw new SyntaxError(`illegal function definition`, this);
    }
    const functionEntity = new FunctionEntity(functionType.name, ctx.fileName,
        ctx.currentScope.getScopeName() + "@" + functionType.name, functionType);
    if (ctx.scopeMap.get(functionEntity.fullName) !== undefined) {
        throw new SyntaxError(`The function name ${functionEntity.fullName} has been defined`, this);
    }
    ctx.enterFunction(functionEntity);
    // alloc parameters
    let loc = 8;
    for (let i = 0; i < functionEntity.type.parameterTypes.length; i++) {
        const type = functionEntity.type.parameterTypes[i];
        const name = functionEntity.type.parameterNames[i];
        if (!name ) {
            throw new SyntaxError(`unnamed parameter`, this);
        }
        if (!ctx.currentScope.map.has(name)) {
            throw new SyntaxError(`redefined parameter`, this);
        }
        ctx.currentScope.set(name, new Variable(
            name, ctx.fileName, type, VariableStorageType.STACK, loc,
        ));
        loc += type.length;
    }
    ctx.currentNode = this;
    const l0 = ctx.currentBuilder!.now;
    ctx.build(OpCode.SSP, 0);
    this.body.body.map((item) => item.codegen(ctx));
    ctx.currentBuilder.codeView.setInt32(l0 + 1, ctx.memory.stackPtr);
    ctx.exitFunction();
};

CallExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    const callee = this.callee.codegen(ctx);
    if (callee.type instanceof PointerType) {
        callee.type = callee.type.elementType;
    }
    if (!(callee.type instanceof FunctionType)) {
        throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);
    }
    // TODO:: call function pointer
    const entity = callee.value as FunctionEntity;
    if (this.arguments.length !== callee.type.parameterTypes.length) {
        throw new SyntaxError(`expected ${callee.type.parameterTypes.length} parameters,`
            + `actual is ${this.arguments.length}`, this);
    }
    for (let i = this.arguments.length - 1; i >= 0; i--) {
        const val = this.arguments[i].codegen(ctx);
        const leftType = extractRealType(callee.type.parameterTypes[i]);
        const rightType = extractRealType(val.type);

        // 这里应用 赋值隐式类型转换
        loadIntoStack(ctx, val);
        convertTypeOnStack(ctx, leftType, rightType, this);
        ctx.currentNode = this;
    }
    // TODO:: mangled name
    ctx.unresolve(entity.fullName);
    if ( entity.isLibCall ) {
        ctx.build(OpCode.LIBCALL, 0);
    } else {
        ctx.build(OpCode.CALL, 0);
        loadFromMemory(ctx, entity.type.returnType);
    }
    return {
        form: ExpressionResultType.RVALUE,
        type: callee.type.returnType,
        value: 0,
    };
};

export function functions() {
    const a = 1;
    return "";
}
