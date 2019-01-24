import {SyntaxError} from "../../common/error";
import {Directive, Node} from "../../common/node";
import {AddressType, FunctionEntity, OverloadSymbol, Variable} from "../../common/symbol";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType} from "../../type/compound_type";
import {FunctionType} from "../../type/function_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {I32Binary, WBinaryOperation, WBlock, WConst, WFunction, WIfElseBlock, WLoop, WReturn, WType} from "../../wasm";
import {getNativeType} from "../../wasm/constant";
import {WGetGlobal, WGetLocal} from "../../wasm/expression";
import {WStatement} from "../../wasm/node";
import {WFunctionType} from "../../wasm/section";
import {WSetGlobal, WSetLocal} from "../../wasm/statement";
import {CompileContext} from "../context";
import {getInStackSize} from "../conversion";
import {IntegerConstant} from "../expression/integer_constant";
import {FunctionLookUpResult, getShortName, Scope} from "../scope";
import {ReturnStatement} from "./return_statement";

export interface FunctionConfig {
    name: string;
    functionType: FunctionType;
    parameterNames: string[];
    parameterInits: Array<string | null>;
    accessControl: AccessControl;
    isLibCall: boolean;
}

export function createFunctionEntity(ctx: CompileContext, config: FunctionConfig, isDefine: boolean): FunctionEntity {
    const baseName = getShortName(config.name);
    const shortName = baseName + "@" + config.functionType.toMangledName();
    const fullName = ctx.scopeManager.currentContext.scope.fullName + "::" + shortName;
    return new FunctionEntity(shortName, fullName, ctx.fileName,
        config.functionType, config.parameterInits, config.isLibCall, isDefine, config.accessControl,
        ctx.scopeManager.currentContext.activeScopes);
}

export function declareFunction(ctx: CompileContext, config: FunctionConfig, node: Node) {
    const functionEntity = createFunctionEntity(ctx, config, false);
    if (config.isLibCall) {
        functionEntity.shortName = functionEntity.shortName.split("@")[0];
        functionEntity.fullName = functionEntity.fullName.split("@")[0]; // libcall no overload
        const returnTypes: WType[] = [];
        const parametersTypes: WType[] = [];
        for (let i = functionEntity.type.parameterTypes.length - 1; i >= 0; i--) {
            const paramType = functionEntity.type.parameterTypes[i];
            if (!(paramType instanceof ClassType || paramType instanceof ArrayType ||
                (functionEntity.type.variableArguments
                    && i === functionEntity.type.parameterTypes.length - 1))) {
                parametersTypes.push(paramType.toWType());
            }
        }
        const returnType = functionEntity.type.returnType;
        if (!returnType.equals(PrimitiveTypes.void)) {
            if (returnType instanceof ClassType || returnType instanceof ArrayType) {
                returnTypes.push(WType.i32);
            } else {
                returnTypes.push(getNativeType(returnType.toWType()));
            }
        }
        if (!ctx.scopeManager.lookup(functionEntity.fullName)) {
            ctx.imports.push({
                name: functionEntity.fullName,
                type: new WFunctionType(returnTypes, parametersTypes),
            });
        }
    }
    ctx.scopeManager.declare(config.name, functionEntity, node);
}

export function defineFunction(ctx: CompileContext, config: FunctionConfig,
                               body: Directive[], activeScopes: Scope[], node: Node) {

    if (config.parameterInits.length !== config.parameterNames.length
        || config.parameterNames.length !== config.functionType.parameterTypes.length) {
        throw new SyntaxError(`parameter length mismatch`, node);
    }
    const emptyLocation = Node.getEmptyLocation();

    const functionEntity = createFunctionEntity(ctx, config, true);

    // find out the active scopes when declare

    ctx.scopeManager.define(config.name, functionEntity, node);
    ctx.enterFunction(functionEntity);
    ctx.scopeManager.activeScopes(activeScopes);

    // alloc parameters

    const returnWTypes: WType[] = [];
    const parameterWTypes: WType[] = [];

    let stackParameterNow = 0;
    for (let i = functionEntity.type.parameterTypes.length - 1; i >= 0; i--) {
        const type = functionEntity.type.parameterTypes[i];
        const paramName = config.parameterNames[i];
        if (!paramName) {
            throw new SyntaxError(`unnamed parameter`, node);
        }
        if (type instanceof ClassType || (functionEntity.type.variableArguments)) {
            ctx.scopeManager.define(paramName, new Variable(
                paramName, ctx.scopeManager.getFullName(paramName), ctx.fileName,
                type, AddressType.STACK, stackParameterNow, config.accessControl,
            ), node);
            stackParameterNow += getInStackSize(type.length);
        }
    }
    for (let i = 0; i < functionEntity.type.parameterTypes.length; i++) {
        const type = functionEntity.type.parameterTypes[i];
        const paramName = config.parameterNames[i];
        if (!paramName) {
            throw new SyntaxError(`unnamed parameter`, node);
        }
        if (!(type instanceof ClassType || (functionEntity.type.variableArguments))) {
            parameterWTypes.push(type.toWType());
            ctx.scopeManager.define(paramName, new Variable(
                paramName, ctx.scopeManager.getFullName(paramName), ctx.fileName,
                type, AddressType.LOCAL, ctx.memory.allocLocal(type.toWType(), true),
                AccessControl.Public,
            ), node);
        }
    }

    const returnType = functionEntity.type.returnType;

    if (!returnType.equals(PrimitiveTypes.void)) {
        if (returnType instanceof ClassType || returnType instanceof ArrayType) {
            returnWTypes.push(WType.i32);
        } else {
            returnWTypes.push(getNativeType(returnType.toWType()));
        }
    }

    // register sp & bp
    // TODO:: could optimize it out, if offset = 0
    functionEntity.$sp = ctx.memory.allocLocal(WType.u32);

    // bp = $sp
    ctx.submitStatement(
        new WSetLocal(WType.u32, functionEntity.$sp,
            new WGetGlobal(WType.u32, "$sp", emptyLocation), emptyLocation));

    // $sp = $sp - 0
    const offsetNode = new WConst(WType.i32, "0", emptyLocation);
    ctx.submitStatement(
        new WSetGlobal(WType.u32, "$sp",
            new WBinaryOperation(I32Binary.add,
                new WGetLocal(WType.u32, functionEntity.$sp, emptyLocation),
                offsetNode, emptyLocation), emptyLocation));

    body.map((item) => item.codegen(ctx));

    offsetNode.constant = ctx.memory.currentState.stackPtr.toString();

    const bodyStatements = ctx.getStatementContainer();

    if (!functionEntity.type.returnType.equals(PrimitiveTypes.void)) {
        let curBlk: WStatement[] = bodyStatements;
        while (curBlk.length > 0
        && curBlk[curBlk.length - 1] instanceof WBlock
        || curBlk[curBlk.length - 1] instanceof WIfElseBlock
        || curBlk[curBlk.length - 1] instanceof WLoop) {
            const item = curBlk[curBlk.length - 1];
            if (item instanceof WBlock || item instanceof WLoop) {
                curBlk = item.body;
            } else if (item instanceof WIfElseBlock) {
                if (item.alternative === null) {
                    throw new SyntaxError(`not all path of function contains return in `
                        + `${functionEntity.fullName}`, node);
                } else {
                    curBlk = item.alternative;
                }
            } else {
                throw new SyntaxError(`not all path of function contains return in ${functionEntity.fullName}`, node);
            }
        }
        if (curBlk.length === 0 || !(curBlk[curBlk.length - 1] instanceof WReturn)) {
            throw new SyntaxError(`not all path of function contains return in ${functionEntity.fullName}`, node);
        }
        if (bodyStatements.length > 0 && bodyStatements[bodyStatements.length - 1] instanceof WIfElseBlock) {
            // should do auto injection A FAKE RETURN;
            new ReturnStatement(emptyLocation, IntegerConstant.ZeroConstant).codegen(ctx);
        }
    }
    const local = ctx.memory.currentState.localTypes;
    ctx.exitFunction();
    ctx.submitFunction(new WFunction(
        functionEntity.fullName,
        config.functionType.toDisplayString(functionEntity.shortName),
        returnWTypes,
        parameterWTypes,
        local, // TODO:: add local
        bodyStatements,
        node.location,
    ));
}
