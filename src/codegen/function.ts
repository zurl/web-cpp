/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {inspect} from "util";
import {
    CallExpression,
    Declarator, ExpressionResult,
    FunctionDeclarator,
    FunctionDefinition,
    IdentifierDeclarator,
    ParameterList,
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
import {
    I32Binary,
    WBinaryOperation,
    WBlock,
    WCall,
    WConst,
    WFunction,
    WIfElseBlock,
    WLoop,
    WReturn,
    WType,
} from "../wasm";
import {WFakeExpression, WGetGlobal, WGetLocal} from "../wasm/expression";
import {WExpression, WStatement} from "../wasm/node";
import {WSetGlobal, WSetLocal} from "../wasm/statement";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doConversion, doValuePromote, getInStackSize} from "./conversion";
import {doFunctionOverLoadResolution} from "./cpp/overload";
import {mergeTypeWithDeclarator, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {FunctionLookUpResult} from "./scope";

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
    const realName = functionType.name + "@" + functionType.toMangledName();
    const fullName = ctx.scopeManager.getFullName(realName);
    const functionEntity = new FunctionEntity(realName, fullName,
        ctx.fileName, functionType, false, true);
    ctx.scopeManager.define(realName, functionEntity, this);
    ctx.enterFunction(functionEntity);

    // alloc parameters

    const returnWTypes: WType[] = [];
    const parameterWTypes: WType[] = [];

    let stackParameterNow = 0;
    for (let i = functionEntity.type.parameterTypes.length - 1; i >= 0; i--) {
        const type = functionEntity.type.parameterTypes[i];
        const name = functionEntity.type.parameterNames[i];
        if (!name) {
            throw new SyntaxError(`unnamed parameter`, this);
        }
        if ( type instanceof ClassType || type instanceof ArrayType ||
            (functionEntity.type.variableArguments
                && i === functionEntity.type.parameterTypes.length - 1)) {
            ctx.scopeManager.define(name, new Variable(
                name, ctx.scopeManager.getFullName(name), ctx.fileName,
                type, AddressType.STACK, stackParameterNow,
            ), this);
            stackParameterNow += getInStackSize(type.length);
        } else {
            parameterWTypes.push(type.toWType());
            ctx.scopeManager.define(name, new Variable(
                name, ctx.scopeManager.getFullName(name), ctx.fileName,
                type, AddressType.LOCAL, ctx.memory.allocLocal(type.toWType()),
            ), this);
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

    // bp = $sp
    ctx.submitStatement(
        new WSetLocal(WType.u32, functionEntity.$sp,
            new WGetGlobal(WType.u32, "$sp", this.location), this.location));

    // $sp = $sp - 0
    const offsetNode = new WConst(WType.i32, "0", this.location);
    ctx.submitStatement(
        new WSetGlobal(WType.u32, "$sp",
            new WBinaryOperation(I32Binary.add,
                new WGetLocal(WType.u32, functionEntity.$sp, this.location),
                offsetNode, this.location), this.location));

    this.body.body.map((item) => item.codegen(ctx));

    offsetNode.constant = ctx.memory.stackPtr.toString();

    if ( !functionEntity.type.returnType.equals(PrimitiveTypes.void)) {
        let curBlk: WStatement[] = bodyStatements;
        while (curBlk.length > 0
        && curBlk[curBlk.length - 1] instanceof WBlock
        || curBlk[curBlk.length - 1] instanceof WIfElseBlock
        || curBlk[curBlk.length - 1] instanceof WLoop) {
            const item = curBlk[curBlk.length - 1];
            if ( item instanceof WBlock || item instanceof WLoop) {
                curBlk = item.body;
            } else if ( item instanceof WIfElseBlock ) {
                if ( item.alternative === null ) {
                    throw new SyntaxError(`not all path of function contains return in `
                        + `${functionEntity.fullName}`, this);
                } else {
                    curBlk = item.alternative;
                }
            } else {
                throw new SyntaxError(`not all path of function contains return in ${functionEntity.fullName}`, this);
            }
        }
        if (curBlk.length === 0 || !(curBlk[curBlk.length - 1] instanceof WReturn)) {
            throw new SyntaxError(`not all path of function contains return in ${functionEntity.fullName}`, this);
        }
        if ( bodyStatements.length > 0 && bodyStatements[bodyStatements.length - 1] instanceof WIfElseBlock) {
            // should do auto injection;
            ctx.submitStatement(new WReturn(new WConst(
                functionEntity.type.returnType.toWType(), "0"), this.location));
        }
    }

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

    const lookUpResult = callee.expr;
    if ( !(lookUpResult instanceof FunctionLookUpResult)) {
        throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);
    }

    let entity: FunctionEntity | null = lookUpResult.functions[0];

    if ( ctx.isCpp() ) {
        entity = doFunctionOverLoadResolution(lookUpResult, this.arguments.map((x) => x.deduceType(ctx)));
    }

    if (entity === null ) {
        throw new SyntaxError(`no matching function for ${lookUpResult.functions[0].name}`, this);
    }

    const funcType = entity.type;

    if ( funcType.parameterTypes.length > this.arguments.length ) {
        throw new SyntaxError(`function call parameters number mismatch`, this);
    }

    const argus: WExpression[] = [];
    let stackOffset = 0;

    if (funcType.variableArguments) {
        for (let i = this.arguments.length - 1;
                i > funcType.parameterTypes.length - 1; i--) {
            const src = this.arguments[i].codegen(ctx);
            const newSrc = doValuePromote(ctx, src, this);
            stackOffset -= getInStackSize(newSrc.type.length);
            if ( newSrc.expr instanceof FunctionLookUpResult) {
                throw new SyntaxError(`unsupport function name`, this);
            }
            argus.push(new WFakeExpression(
                new WAddressHolder(stackOffset, AddressType.GLOBAL_SP, this.location)
                    .createStore(ctx, newSrc.type, newSrc.expr, true)
                , this.location));
        }
        argus.push(new WConst(WType.u32, this.arguments.length.toString()));
    } else {
        if ( funcType.parameterTypes.length < this.arguments.length ) {
            throw new SyntaxError(`function call parameters number mismatch`, this);
        }
    }

    for (let i = funcType.parameterTypes.length - 1; i >= 0; i--) {
        const dstType = funcType.parameterTypes[i];
        const src = this.arguments[i].codegen(ctx);
        const srcExpr = doConversion(ctx, dstType, src, this).fold();
        if ( dstType instanceof ClassType || dstType instanceof ArrayType ||
            (funcType.variableArguments
                && i === funcType.parameterTypes.length - 1)) {
            stackOffset -= getInStackSize(src.type.length);
            argus.push(new WFakeExpression(
                new WAddressHolder(stackOffset, AddressType.GLOBAL_SP, this.location)
                    .createStore(ctx, src.type, srcExpr, true)
                , this.location));
        } else {
            argus.push(srcExpr);
        }
    }

    const afterStatements: WStatement[] = [];

    if ( stackOffset !== 0 ) {
        argus.push(new WFakeExpression(new WSetGlobal(WType.u32, "$sp",
            new WBinaryOperation(I32Binary.add,
                new WGetGlobal(WType.u32, "$sp", this.location),
                new WConst(WType.i32, stackOffset.toString()),
                this.location)), this.location));
        afterStatements.push(new WFakeExpression(new WSetGlobal(WType.u32, "$sp",
            new WBinaryOperation(I32Binary.sub,
                new WGetGlobal(WType.u32, "$sp", this.location),
                new WConst(WType.i32, stackOffset.toString()),
                this.location)), this.location));

    }

    return {
        type: funcType.returnType,
        expr: new WCall(entity.fullName, argus, afterStatements, this.location),
        isLeft: false,
    };
};

export function functions() {
    const a = 1;
    return "";
}
