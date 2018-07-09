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
    ParameterList, ReturnStatement,
} from "../common/ast";
import {assertType, InternalError, SyntaxError} from "../common/error";
import {OpCode} from "../common/instruction";
import {
    extractRealType, FloatType,
    FunctionType,
    PointerType, PrimitiveTypes,
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
        const [parameterTypes, parameterNames, variableArguments] = (node.parameters as ParameterList).codegen(ctx);
        return new FunctionType(node.declarator.identifier.name,
            resultType, parameterTypes,
            parameterNames, variableArguments);
    } else if (node.declarator != null) {
        const newResultType = mergeTypeWithDeclarator(ctx, resultType, node);
        return parseFunctionDeclarator(ctx, node.declarator, newResultType);
    } else {
        throw new SyntaxError("UnsupportNodeType:" + node.constructor.name, node);
    }
}

ParameterList.prototype.codegen = function(ctx: CompileContext): [Type[], string[], boolean] {
    ctx.currentNode = this;
    // TODO:: deal with abstract Declarator
    const parameters = this.parameters.map((parameter) =>
        parseDeclarator(ctx, parameter.declarator as Declarator,
            parseTypeFromSpecifiers(ctx, parameter.specifiers, this)));
    const parameterTypes = parameters.map((x) => x[0]);
    const parameterNames = parameters.map((x) => x[1]);
    return [parameterTypes, parameterNames, this.variableArguments];
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
    const fullName = ctx.currentScope.getScopeName() + "@" + functionType.name;
    let functionEntity: FunctionEntity;
    const oldEntity = ctx.currentScope.get(functionType.name);
    if (oldEntity) {
       if ( !(oldEntity instanceof FunctionEntity)) {
           throw new SyntaxError(`The function ${functionType.name} has been defined var/type`, this);
       } else if ( oldEntity.isLibCall ) {
           return;
       } else if ( oldEntity.isDefine() ) {
           throw new SyntaxError(`The function ${functionType.name} has been defined `, this);
       } else {
            functionEntity = oldEntity;
       }
    } else {
        functionEntity = new FunctionEntity(functionType.name, ctx.fileName, fullName, functionType);
        ctx.currentScope.set(functionEntity.name, functionEntity);
    }
    ctx.enterFunction(functionEntity);
    // alloc parameters
    let loc = 8;
    for (let i = 0; i < functionEntity.type.parameterTypes.length; i++) {
        const type = functionEntity.type.parameterTypes[i];
        const name = functionEntity.type.parameterNames[i];
        if (!name) {
            throw new SyntaxError(`unnamed parameter`, this);
        }
        if (ctx.currentScope.map.has(name)) {
            throw new SyntaxError(`redefined parameter ${name}`, this);
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
    ctx.currentFunction!.assertPostions.map((pos) => {
        ctx.currentBuilder.codeView.setInt32(pos + 1, ctx.memory.stackPtr);
    });
    const l1 = ctx.currentBuilder.now;
    const op = ctx.currentBuilder.codeView.getUint8(l1 - 5);
    if ( op !== OpCode.RETVARGS && op !== OpCode.RET) {
        if ( functionEntity.type.returnType.equals(PrimitiveTypes.void)) {
            new ReturnStatement(this.location, null).codegen(ctx);
        } else {
            throw new SyntaxError(`Not of all branch of Function ${functionEntity.fullName} has return`, this);
        }
    }
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
    if ((entity.type.variableArguments && this.arguments.length < callee.type.parameterTypes.length) ||
        (!entity.type.variableArguments && this.arguments.length !== callee.type.parameterTypes.length)) {
        throw new SyntaxError(`expected ${callee.type.parameterTypes.length} parameters,`
            + `actual is ${this.arguments.length}`, this);
    }
    if (entity.type.variableArguments) {
        let varLength = 0;
        for (let i = this.arguments.length - 1; i >= callee.type.parameterTypes.length; i--) {
            const val = this.arguments[i].codegen(ctx);
            ctx.currentNode = this;
            const rawType = extractRealType(val.type);
            loadIntoStack(ctx, val);
            if (entity.type.variableArguments && rawType instanceof FloatType) {
                ctx.build(OpCode.F2D);
                varLength += 4;
            }
            if (rawType.length > 4) {
                varLength += rawType.length;
            } else {
                varLength += 4;
            }
        }
        ctx.build(OpCode.PUI32, varLength);
    }
    for (let i = callee.type.parameterTypes.length - 1; i >= 0; i--) {
        const val = this.arguments[i].codegen(ctx);
        const leftType = extractRealType(callee.type.parameterTypes[i]);
        const rightType = extractRealType(val.type);

        // 这里应用 赋值隐式类型转换
        ctx.currentNode = this;
        loadIntoStack(ctx, val);
        convertTypeOnStack(ctx, leftType, rightType);
    }
    // TODO:: mangled name
    ctx.unresolve(entity.fullName);
    if (entity.isLibCall) {
        ctx.build(OpCode.LIBCALL, 0);
    } else {
        ctx.build(OpCode.CALL, 0);
        if (!entity.type.returnType.equals(PrimitiveTypes.void)) {
            loadFromMemory(ctx, entity.type.returnType);
        }
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
