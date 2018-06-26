/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {
    AbstractDeclarator, CallExpression,
    Declarator, ExpressionResult, ExpressionResultType,
    FunctionDeclarator,
    FunctionDefinition,
    IdentifierDeclarator,
    Node,
    ParameterList, PointerDeclarator, SpecifierType
} from "../common/ast";
import {CompileContext} from "./context";
import {FunctionType, PointerType, QualifiedType, Type} from "../common/type";
import {assertType, InternalError, SyntaxError} from "../common/error";
import {getPrimitiveTypeFromSpecifiers, isTypeQualifier, isTypeSpecifier} from "../common/utils";
import {mergeTypeWithDeclarator, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {FunctionEntity, Variable, VariableStorageType} from "./scope";
import {loadIntoStack} from "./stack";
import {OpCode} from "../common/instruction";

function parseFunctionDeclarator(ctx: CompileContext, node: Declarator,
                                 resultType: Type): FunctionType {
    if (node instanceof FunctionDeclarator && node.declarator instanceof IdentifierDeclarator) {
        assertType(node.parameters, ParameterList);
        const [parameterTypes, parameterNames] = (node.parameters as ParameterList).codegen(ctx);
        return new FunctionType(node.declarator.identifier.name, resultType, parameterTypes, parameterNames);
    }
    else if (node.declarator != null) {
        const newResultType = mergeTypeWithDeclarator(ctx, resultType, node);
        return parseFunctionDeclarator(ctx, node.declarator, newResultType);
    }
    else {
        throw new SyntaxError("UnsupportNodeType:" + node.constructor.name, node);
    }
}

ParameterList.prototype.codegen = function (ctx: CompileContext): [Type[], string[]] {
    ctx.currentNode = this;
    // TODO:: deal with abstract Declarator
    const parameters = this.parameters.map(parameter =>
        parseDeclarator(ctx, parameter.declarator as Declarator,
            parseTypeFromSpecifiers(parameter.specifiers, this)));
    const parameterTypes = parameters.map(x => x[0]);
    const parameterNames = parameters.map(x => x[1]);
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
FunctionDefinition.prototype.codegen = function (ctx: CompileContext) {
    ctx.currentNode = this;
    const resultType = parseTypeFromSpecifiers(this.specifiers, this);
    if (resultType == null) {
        throw new SyntaxError(`illegal return type`, this);
    }
    const functionType = parseFunctionDeclarator(ctx, this.declarator, resultType);
    if (functionType == null) {
        throw new SyntaxError(`illegal function definition`, this);
    }
    const functionEntity = new FunctionEntity(functionType.name, ctx.fileName,
        ctx.currentScope.getScopeName() + "@" + functionType.name, functionType);
    if (ctx.scopeMap.get(functionEntity.name) !== undefined) {
        throw new SyntaxError(`The function name ${functionType.name} has been defined`, this);
    }
    ctx.enterFunction(functionEntity.name, functionEntity);
    // alloc parameters
    let loc = 8;
    for (let i = 0; i < functionEntity.type.parameterTypes.length; i++) {
        const type = functionEntity.type.parameterTypes[i];
        const name = functionEntity.type.parameterNames[i];
        if (!name) {
            throw new SyntaxError(`unnamed parameter`, this);
        }
        ctx.currentScope.set(name, new Variable(
            name, ctx.fileName, type, VariableStorageType.STACK, loc
        ));
        loc += type.length;
    }
    this.body.body.map(item => item.codegen(ctx));
    ctx.exitFunction();
};

CallExpression.prototype.codegen = function (ctx: CompileContext): ExpressionResult {
    ctx.currentNode = this;
    let callee = this.callee.codegen(ctx);
    if (callee.type instanceof PointerType) {
        callee.type = callee.type.elementType
    }
    if (!(callee.type instanceof FunctionType)) {
        throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);
    }
    // TODO:: call function pointer
    const fullName = callee.value as string;
    if (this.arguments.length != callee.type.parameterTypes.length) {
        throw new SyntaxError(`expected ${callee.type.parameterTypes.length} parameters, actual is ${this.arguments.length}`, this);
    }
    for (let i = this.arguments.length - 1; i >= 0; i--) {
        const val = this.arguments[i].codegen(ctx);
        if (!val.type.equals(callee.type.parameterTypes[i])) {
            throw new SyntaxError(`the function type is not same oh`, this);
        }
        ctx.currentNode = this;
        loadIntoStack(ctx, val);
    }
    // TODO:: mangled name
    ctx.unresolve(fullName);
    ctx.build(OpCode.CALL, 0);
    return {
        form: ExpressionResultType.RVALUE,
        type: callee.type.returnType,
        value: 0
    }
};


export function functions() {
    const a = 1;
    return "";
}