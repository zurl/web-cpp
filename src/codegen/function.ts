/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {
    CallExpression,
    Declarator, ExpressionResult,
    FunctionDeclarator,
    FunctionDefinition,
    IdentifierDeclarator,
    ParameterList, ReturnStatement,
} from "../common/ast";
import {assertType, SyntaxError} from "../common/error";
import {
    AddressType, ArrayType, ClassType,
    FunctionType,
    PointerType,
    PrimitiveTypes,
    Type,
    Variable,
} from "../common/type";
import {FunctionEntity} from "../common/type";
import {I32Binary, WBinaryOperation, WCall, WConst, WFunction, WLoad, WType} from "../wasm";
import {WGetGlobal, WGetLocal} from "../wasm/expression";
import {WExpression, WStatement} from "../wasm/node";
import {WSetGlobal, WSetLocal} from "../wasm/statement";
import {CompileContext} from "./context";
import {doConversion} from "./conversion";
import {mergeTypeWithDeclarator, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";

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
    // TODO:: deal with abstract Declarator
    const parameters = this.parameters.map((parameter) =>
        parseDeclarator(ctx, parameter.declarator as Declarator,
            parseTypeFromSpecifiers(ctx, parameter.specifiers, this)));
    const parameterTypes = parameters.map((x) => x[0]);
    const parameterNames = parameters.map((x) => x[1]);
    return [parameterTypes, parameterNames, this.variableArguments];
};

FunctionDefinition.prototype.codegen = function(ctx: CompileContext) {
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

    const returnWTypes: WType[] = [];
    const parameterWTypes: WType[] = [];

    for (let i = 0; i < functionEntity.type.parameterTypes.length; i++) {
        const type = functionEntity.type.parameterTypes[i];
        const name = functionEntity.type.parameterNames[i];
        if (!name) {
            throw new SyntaxError(`unnamed parameter`, this);
        }
        if (ctx.currentScope.map.has(name)) {
            throw new SyntaxError(`redefined parameter ${name}`, this);
        }
        if ( type instanceof ClassType || type instanceof ArrayType) {
            ctx.currentScope.set(name, new Variable(
                name, ctx.fileName, type, AddressType.STACK, ctx.memory.allocStack(type.length),
            ));
        } else {
            parameterWTypes.push(type.toWType());
            ctx.currentScope.set(name, new Variable(
                name, ctx.fileName, type, AddressType.LOCAL, ctx.memory.allocLocal(type.toWType()),
            ));
        }
    }

    const returnType = functionEntity.type.returnType;
    if (!returnType.equals(PrimitiveTypes.void)) {
        if ( returnType instanceof ClassType || returnType instanceof ArrayType) {
            returnWTypes.push(WType.i32);
        } else {
            returnWTypes.push(returnType.toWType());
        }
    }

    const bodyStatements: WStatement[] = [];
    const savedStatements = ctx.getStatementContainer();
    ctx.setStatementContainer(bodyStatements);

    // register sp & bp
    // TODO:: could optimize it out
    functionEntity.$sp = ctx.memory.allocLocal(WType.u32);

    // sp = $sp
    ctx.submitStatement(
        new WSetLocal(WType.u32, functionEntity.$sp,
            new WGetGlobal(WType.u32, "$sp", this.location), this.location));

    // sp = $sp - 0
    const offsetNode = new WConst(WType.u32, "0", this.location);
    ctx.submitStatement(
        new WSetGlobal(WType.u32, "$sp",
            new WBinaryOperation(I32Binary.sub,
                new WGetLocal(WType.u32, functionEntity.$sp, this.location),
                offsetNode, this.location), this.location));

    this.body.body.map((item) => item.codegen(ctx));

    ctx.setStatementContainer(savedStatements);
    ctx.exitFunction();

    ctx.submitFunction(new WFunction(
        functionEntity.fullName,
        returnWTypes,
        parameterWTypes,
        ctx.memory.localTypes, // TODO:: add local
        bodyStatements,
        this.location,
    ));
};

CallExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const callee = this.callee.codegen(ctx);
    if (callee.type instanceof PointerType) {
        callee.type = callee.type.elementType;
    }
    const entity = callee.expr;
    if ( !(callee.type instanceof FunctionType) || !(entity instanceof FunctionEntity)) {
        throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);
    }
    const argus: WExpression[] = [];
    for (let i = callee.type.parameterTypes.length - 1; i >= 0; i--) {
        const src = this.arguments[i].codegen(ctx);
        const dstType = callee.type.parameterTypes[i];
        argus.push(doConversion(ctx, dstType, src, this));
    }
    return {
        type: callee.type.returnType,
        expr: new WCall(entity.fullName, argus, this.location),
        isLeft: false,
    };
};

export function functions() {
    const a = 1;
    return "";
}
