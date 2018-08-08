/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import Long = require("long");
import {
    AnonymousExpression, AssignmentExpression, BinaryExpression,
    CallExpression, CastExpression, CompoundStatement,
    ConstructorCallExpression,
    Declaration,
    Declarator, DeleteExpression, Expression,
    ExpressionResult, ExpressionStatement, ForStatement,
    FunctionDeclarator,
    FunctionDefinition,
    Identifier,
    IdentifierDeclarator, InitDeclarator,
    IntegerConstant, MemberExpression, NewExpression,
    Node,
    ParameterList,
    ReturnStatement,
    Statement,
    UnaryExpression,
} from "../common/ast";
import {assertType,  LanguageError, SyntaxError} from "../common/error";
import {AddressType, FunctionEntity, Variable} from "../common/symbol";
import {AccessControl, Type} from "../type";
import {ClassType} from "../type/class_type";
import {ArrayType, PointerType, ReferenceType} from "../type/compound_type";
import {CppFunctionType, FunctionType} from "../type/function_type";
import {PrimitiveTypes} from "../type/primitive_type";
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
import {getNativeType} from "../wasm/constant";
import {WCallIndirect, WFakeExpression, WGetGlobal, WGetLocal} from "../wasm/expression";
import {WExpression, WStatement} from "../wasm/node";
import {WFunctionType} from "../wasm/section";
import {WDrop, WSetGlobal, WSetLocal} from "../wasm/statement";
import {WAddressHolder} from "./address";
import {CompileContext} from "./context";
import {doConversion, doTypeTransfrom, doValuePromote, getInStackSize} from "./conversion";
import {getCtorStmts, getDtorStmts} from "./cpp/lifecycle";
import {doFunctionOverloadResolution, isFunctionExists} from "./cpp/overload";
import {mergeTypeWithDeclarator, parseDeclarator, parseTypeFromSpecifiers} from "./declaration";
import {FunctionLookUpResult} from "./scope";
import {recycleExpressionResult} from "./statement";

export function parseFunctionDeclarator(ctx: CompileContext, node: Declarator,
                                        resultType: Type): FunctionType {
    if (node instanceof FunctionDeclarator && node.declarator instanceof IdentifierDeclarator) {
        assertType(node.parameters, ParameterList);
        const [parameterTypes, parameterNames, variableArguments] = (node.parameters as ParameterList).codegen(ctx);
        const result = new FunctionType(node.declarator.identifier.name,
            resultType, parameterTypes,
            parameterNames, variableArguments);
        if (resultType.isStatic) {
            result.isStatic = true;
            resultType.isStatic = false;
        }
        return result;
    } else if (node.declarator != null) {
        const newResultType = mergeTypeWithDeclarator(ctx, resultType, node);
        return parseFunctionDeclarator(ctx, node.declarator, newResultType);
    } else {
        throw new SyntaxError("UnsupportNodeType:" + node.constructor.name, node);
    }
}

export function declareFunction(ctx: CompileContext, functionType: FunctionType,
                                isLibCall: boolean, accessControl: AccessControl,
                                node: Node) {
    const realName = functionType.name + "@" + functionType.toMangledName();
    const fullName = ctx.scopeManager.getFullName(realName);
    const entity = new FunctionEntity(realName, fullName, ctx.fileName,
        functionType, false, false, accessControl);
    if (isLibCall) {
        entity.isLibCall = true;
        entity.name = functionType.name;
        entity.fullName = ctx.scopeManager.getFullName(functionType.name); // libcall no overload
        const returnTypes: WType[] = [];
        const parametersTypes: WType[] = [];
        for (let i = entity.type.parameterTypes.length - 1; i >= 0; i--) {
            const paramType = entity.type.parameterTypes[i];
            if (!(paramType instanceof ClassType || paramType instanceof ArrayType ||
                (entity.type.variableArguments
                    && i === entity.type.parameterTypes.length - 1))) {
                parametersTypes.push(paramType.toWType());
            }
        }
        const returnType = entity.type.returnType;
        if (!returnType.equals(PrimitiveTypes.void)) {
            if (returnType instanceof ClassType || returnType instanceof ArrayType) {
                returnTypes.push(WType.i32);
            } else {
                returnTypes.push(getNativeType(returnType.toWType()));
            }
        }
        if (!ctx.scopeManager.lookupFullName(entity.fullName)) {
            ctx.imports.push({
                name: entity.fullName,
                type: new WFunctionType(returnTypes, parametersTypes),
            });
        }
    }
    ctx.scopeManager.declare(functionType.name, entity, node);
}

export function defineFunction(ctx: CompileContext, functionType: FunctionType,
                               body: Array<Statement | Declaration>, accessControl: AccessControl,
                               node: Node) {
    const realName = functionType.name + "@" + functionType.toMangledName();
    const fullName = ctx.scopeManager.getFullName(realName);
    const functionEntity = new FunctionEntity(realName, fullName,
        ctx.fileName, functionType, false, true, accessControl);
    ctx.scopeManager.define(realName, functionEntity, node);
    ctx.enterFunction(functionEntity);

    // alloc parameters

    const returnWTypes: WType[] = [];
    const parameterWTypes: WType[] = [];

    let stackParameterNow = 0;
    for (let i = functionEntity.type.parameterTypes.length - 1; i >= 0; i--) {
        const type = functionEntity.type.parameterTypes[i];
        const paramName = functionEntity.type.parameterNames[i];
        if (!paramName) {
            throw new SyntaxError(`unnamed parameter`, node);
        }
        if (type instanceof ClassType || (functionEntity.type.variableArguments)) {
            ctx.scopeManager.define(paramName, new Variable(
                paramName, ctx.scopeManager.getFullName(paramName), ctx.fileName,
                type, AddressType.STACK, stackParameterNow,
            ), node);
            stackParameterNow += getInStackSize(type.length);
        }
    }
    for (let i = 0; i < functionEntity.type.parameterTypes.length; i++) {
        const type = functionEntity.type.parameterTypes[i];
        const paramName = functionEntity.type.parameterNames[i];
        if (!paramName) {
            throw new SyntaxError(`unnamed parameter`, node);
        }
        if (!(type instanceof ClassType || (functionEntity.type.variableArguments))) {
            parameterWTypes.push(type.toWType());
            ctx.scopeManager.define(paramName, new Variable(
                paramName, ctx.scopeManager.getFullName(paramName), ctx.fileName,
                type, AddressType.LOCAL, ctx.memory.allocLocal(type.toWType(), true),
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

    const bodyStatements: WStatement[] = [];
    const savedStatements = ctx.getStatementContainer();
    ctx.setStatementContainer(bodyStatements);

    // register sp & bp
    // TODO:: could optimize it out
    functionEntity.$sp = ctx.memory.allocLocal(WType.u32);

    // bp = $sp
    ctx.submitStatement(
        new WSetLocal(WType.u32, functionEntity.$sp,
            new WGetGlobal(WType.u32, "$sp", node.location), node.location));

    // $sp = $sp - 0
    const offsetNode = new WConst(WType.i32, "0", node.location);
    ctx.submitStatement(
        new WSetGlobal(WType.u32, "$sp",
            new WBinaryOperation(I32Binary.add,
                new WGetLocal(WType.u32, functionEntity.$sp, node.location),
                offsetNode, node.location), node.location));

    if (functionType.cppFunctionType === CppFunctionType.Constructor) {
        const ctorStmts = getCtorStmts(ctx, functionEntity, node);
        ctorStmts.map((item) => item.codegen(ctx));
    }

    body.map((item) => item.codegen(ctx));

    if (functionType.cppFunctionType === CppFunctionType.Destructor) {
        const dtorStmts = getDtorStmts(ctx, functionEntity, node);
        dtorStmts.map((item) => item.codegen(ctx));
    }

    offsetNode.constant = ctx.memory.stackPtr.toString();

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
            // should do auto injection A FAKE INTEM;
            new ReturnStatement(node.location, IntegerConstant.getZero()).codegen(ctx);
        }
    }
    ctx.exitFunction();
    ctx.setStatementContainer(savedStatements);
    ctx.submitFunction(new WFunction(
        functionEntity.fullName,
        returnWTypes,
        parameterWTypes,
        ctx.memory.localTypes, // TODO:: add local
        bodyStatements,
        node.location,
    ));
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
    defineFunction(ctx, functionType, this.body.body, AccessControl.Public, this);
};

CallExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    const callee = this.callee.codegen(ctx);

    if (callee.type instanceof PointerType) {
        callee.type = callee.type.elementType;
    }

    let funcType: FunctionType;
    let funcEntity: FunctionEntity | null = null;

    const lookUpResult = callee.expr;
    const thisPtrs: ExpressionResult[] = [];

    if (lookUpResult instanceof FunctionLookUpResult) {
        if (!(lookUpResult instanceof FunctionLookUpResult)) {
            throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);
        }

        let entity: FunctionEntity | null = lookUpResult.functions[0];

        if (ctx.isCpp()) {
            entity = doFunctionOverloadResolution(lookUpResult,
                this.arguments.map((x) => doTypeTransfrom(x.deduceType(ctx))), this);
        }

        if (entity === null) {
            throw new SyntaxError(`no matching function for ${lookUpResult.functions[0].name}`, this);
        }
        funcType = entity.type;
        funcEntity = entity;
        if (funcType.isMemberFunction()) {
            if (lookUpResult.instance === null || lookUpResult.instanceType === null) {
                throw new SyntaxError(`call a member function must bind a object`, this);
            }
            thisPtrs.push({
                expr: lookUpResult.instance.createLoadAddress(ctx),
                type: new PointerType(lookUpResult.instanceType),
                isLeft: false,
            });
        }
    } else if (callee.type instanceof FunctionType) {
        funcType = callee.type;
    } else {
        throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);

    }

    const arguExprs = [...thisPtrs, ... this.arguments.map((x) => x.codegen(ctx))];

    if (funcType.parameterTypes.length > arguExprs.length) {
        throw new SyntaxError(`function call parameters number mismatch`, this);
    }

    const argus: WExpression[] = [];
    let stackOffset = 0;

    if (funcType.variableArguments) {
        for (let i = arguExprs.length - 1; i > funcType.parameterTypes.length - 1; i--) {
            const src = arguExprs[i];
            if (src.type instanceof ClassType) {
                throw new SyntaxError(`class type could not be variable arguments`, this);
            }
            const newSrc = doValuePromote(ctx, src, this);
            stackOffset -= getInStackSize(newSrc.type.length);
            if (newSrc.expr instanceof FunctionLookUpResult) {
                throw new SyntaxError(`unsupport function name`, this);
            }
            argus.push(new WFakeExpression(
                new WAddressHolder(stackOffset, AddressType.GLOBAL_SP, this.location)
                    .createStore(ctx, newSrc.type, newSrc.expr, true)
                , this.location));
        }
        // argus.push(new WConst(WType.u32, this.arguments.length.toString()));
    } else {
        if (funcType.parameterTypes.length < this.arguments.length) {
            throw new SyntaxError(`function call parameters number mismatch`, this);
        }
    }

    for (let i = funcType.parameterTypes.length - 1; i >= 0; i--) {
        let dstType = funcType.parameterTypes[i];
        if (dstType instanceof ArrayType) {
            dstType = new PointerType(dstType.elementType);
        }
        const src = arguExprs[i];
        if (dstType instanceof ClassType) {
            const rightType = src.type;
            const leftPtrType = new PointerType(dstType);
            stackOffset -= getInStackSize(dstType.length);
            const left = new AnonymousExpression(this.location, {
                type: leftPtrType,
                isLeft: false,
                expr: new WAddressHolder(stackOffset, AddressType.GLOBAL_SP, this.location)
                    .createLoadAddress(ctx),
            });
            const right = new AnonymousExpression(this.location, src);
            const fullName = dstType.fullName + "::#" + dstType.name;
            let expr: ExpressionResult;
            if (isFunctionExists(ctx, fullName, [leftPtrType, rightType], null)) {
                expr = new CallExpression(this.location,
                    new Identifier(this.location, fullName),
                    [left, right]).codegen(ctx);
            } else {
                const len = dstType.length;
                expr = new CallExpression(this.location, new Identifier(this.location, "::memcpy"), [
                    new UnaryExpression(this.location, "&", left),
                    new UnaryExpression(this.location, "&", right),
                    new IntegerConstant(this.location, 10, Long.fromInt(len), len.toString(), null),
                ]).codegen(ctx);
            }
            if (!(expr.expr instanceof WExpression)) {
                throw new SyntaxError(`illegal arguments`, this);
            }
            argus.push(expr.expr);
        } else {
            const srcExpr = doConversion(ctx, dstType, src, this, false, true).fold();
            if (funcType.variableArguments) {
                stackOffset -= getInStackSize(dstType.length);
                argus.push(new WFakeExpression(
                    new WAddressHolder(stackOffset, AddressType.GLOBAL_SP, this.location)
                        .createStore(ctx, src.type, srcExpr, true)
                    , this.location));
            } else {
                argus.push(srcExpr);
            }
        }
    }
    argus.reverse();    // wasm call standard => push $0 first

    const afterStatements: WStatement[] = [];

    if (stackOffset !== 0) {
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

    let funcExpr: WExpression;

    if (funcEntity === null) {
        callee.type = PrimitiveTypes.int32;
        ctx.requiredWASMFuncTypes.add(funcType.toWASMEncoding()); // require by wasm
        funcExpr = new WCallIndirect(doConversion(ctx, PrimitiveTypes.int32, callee, this),
            funcType.toWASMEncoding(), argus, afterStatements, this.location);
    } else {
        funcExpr = new WCall(funcEntity.fullName, argus, afterStatements, this.location);
    }

    if (funcType.returnType instanceof ClassType) {
        return {
            type: funcType.returnType,
            expr: new WAddressHolder(
                funcExpr,
                AddressType.RVALUE,
                this.location),
            isLeft: true,
        };
    } else {
        return {
            type: funcType.returnType,
            expr: funcExpr,
            isLeft: false,
        };
    }
};

ReturnStatement.prototype.codegen = function(ctx: CompileContext) {
    if (ctx.currentFunction === null) {
        throw new SyntaxError(`return outside function`, this);
    }
    // $sp = sp
    ctx.triggerDtorsInner(this);

    ctx.submitStatement(
        new WSetGlobal(WType.u32, "$sp",
            new WGetLocal(WType.u32, ctx.currentFunction.$sp, this.location), this.location));

    if (this.argument !== null) {
        const returnType = ctx.currentFunction.type.returnType;
        if (returnType.equals(PrimitiveTypes.void)) {
            throw new SyntaxError(`return type mismatch`, this);
        }
        const expr = this.argument.codegen(ctx);
        if (returnType instanceof ClassType || returnType instanceof ReferenceType) {
            if (!(expr.isLeft) || !(expr.expr instanceof WAddressHolder)) {
                throw new SyntaxError(`return a rvalue of reference`, this);
            }
            ctx.submitStatement(new WReturn(expr.expr.createLoadAddress(ctx), this.location));
        } else {
            expr.expr = doConversion(ctx, ctx.currentFunction.type.returnType, expr, this);
            ctx.submitStatement(new WReturn(expr.expr.fold(), this.location));
        }
    } else {
        if (!ctx.currentFunction.type.returnType.equals(PrimitiveTypes.void)) {
            throw new SyntaxError(`return type mismatch`, this);
        }
        ctx.submitStatement(new WReturn(null, this.location));
    }
};

ConstructorCallExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if ( !ctx.isCpp() ) {
        throw new LanguageError(`constructor is noly support in c++`, this);
    }
    const classType = this.deduceType(ctx);
    if (!(classType instanceof ClassType)) {
        throw new SyntaxError(`constructor call must be class type`, this);
    }
    const ctorName = classType.fullName + "::#" + classType.name;
    const callee = new Identifier(this.location, ctorName);
    const [tmpVarName] = ctx.allocTmpVar(classType, this);
    const thisVar = new Identifier(this.location, tmpVarName);
    const thisPtr = new UnaryExpression(this.location, "&", thisVar);
    recycleExpressionResult(ctx, this,
        new CallExpression(this.location, callee, [thisPtr, ...this.arguments]).codegen(ctx));
    return thisVar.codegen(ctx);
};

export function getForLoop(sizeExpr: Expression,
                           statements: (idx: Identifier) => Statement[], node: Node): ForStatement {
    const i = new Identifier(node.location, "i");
    return new ForStatement(node.location,
        // i = 0
        new Declaration(node.location, ["int"], [new InitDeclarator(
            node.location, new IdentifierDeclarator(node.location, i), IntegerConstant.getZero(),
        )]),
        // i < size
        new BinaryExpression(node.location, "<", i, sizeExpr),
        // i ++
        new UnaryExpression(node.location, "++", i),
        new CompoundStatement(node.location, node.location, node.location,
            // new (var[i])
            statements(i),
        ));
}

NewExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if ( !ctx.isCpp() ) {
        throw new LanguageError(`new is noly support in c++`, this);
    }
    const ptrType = this.deduceType(ctx);
    if (!(ptrType instanceof PointerType)) {
        throw new SyntaxError(`new must be pointer`, this);
    }
    const itemType = ptrType.elementType;
    const [ptrVarName] = ctx.allocTmpVar(ptrType, this);
    if ( this.arraySize !== null ) {
        const [sizeVarName] = ctx.allocTmpVar(PrimitiveTypes.int32, this);

        const sizeExpr = IntegerConstant.fromNumber(this.location, itemType.length);

        // size = sizeof(Type) * SizeExpression
        const assignSizeExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, sizeVarName), this.arraySize).codegen(ctx);
        recycleExpressionResult(ctx, this, assignSizeExpr);

        // headPtr = (int *) malloc(size + 4)
        const mallocExpr = new CallExpression(this.location, new Identifier(this.location, "::malloc_array"),
            [
                sizeExpr,
                new Identifier(this.location, sizeVarName),
            ]).codegen(ctx);
        mallocExpr.type = ptrType;

        const assignExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, ptrVarName),
            new AnonymousExpression(this.location, mallocExpr)).codegen(ctx);
        recycleExpressionResult(ctx, this, assignExpr);
        // for(int i = 0; i < size; i++ )
        if (itemType instanceof ClassType) {
            const ctorName = itemType.fullName + "::#" + itemType.name;
            const callee = new Identifier(this.location, ctorName);
            getForLoop(new Identifier(this.location, sizeVarName), (i) => ([
                new ExpressionStatement(this.location,
                    new CallExpression(this.location, callee, [
                        new BinaryExpression(this.location, "+",
                            new Identifier(this.location, ptrVarName),
                            i)]))]), this).codegen(ctx);
        }
    } else {
        const mallocExpr = new CallExpression(this.location, new Identifier(this.location, "::malloc"),
            [IntegerConstant.fromNumber(this.location, itemType.length)]).codegen(ctx);
        mallocExpr.type = ptrType;
        const assignExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, ptrVarName),
            new AnonymousExpression(this.location, mallocExpr)).codegen(ctx);
        recycleExpressionResult(ctx, this, assignExpr);
        if (itemType instanceof ClassType) {
            const ctorName = itemType.fullName + "::#" + itemType.name;
            const callee = new Identifier(this.location, ctorName);
            const ctorExpr = new CallExpression(this.location, callee, [
                new Identifier(this.location, ptrVarName), ...this.arguments]).codegen(ctx);
            recycleExpressionResult(ctx, this, ctorExpr);
        }
    }
    return new Identifier(this.location, ptrVarName).codegen(ctx);
};

DeleteExpression.prototype.codegen = function(ctx: CompileContext): ExpressionResult {
    if (!ctx.isCpp()) {
        throw new LanguageError(`delete is only support in c++`, this);
    }
    const rightType = this.expr.deduceType(ctx);
    if (!(rightType instanceof PointerType)) {
        throw new SyntaxError(`you could only delete pointer`, this);
    }
    if (this.isArrayDelete) {
        const [ptrVarName] = ctx.allocTmpVar(rightType, this);
        const [basePtrVarName] = ctx.allocTmpVar(new PointerType(PrimitiveTypes.int32), this);
        const [sizeVarName] = ctx.allocTmpVar(PrimitiveTypes.int32, this);

        // ptr = ptr
        const assignPtrExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, ptrVarName), this.expr).codegen(ctx);
        recycleExpressionResult(ctx, this, assignPtrExpr);

        const tmpPtrExpr = new Identifier(this.location, ptrVarName).codegen(ctx);
        tmpPtrExpr.type = new PointerType(PrimitiveTypes.int32);

        // basePtr = (int*)ptr - 1
        const basePtrExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, basePtrVarName), new BinaryExpression(
                this.location, "-", new AnonymousExpression(this.location, tmpPtrExpr),
                IntegerConstant.getOne(),
            )).codegen(ctx);
        recycleExpressionResult(ctx, this, basePtrExpr);

        // size = *basePtr
        const assignSizeExpr = new AssignmentExpression(this.location, "=",
            new Identifier(this.location, sizeVarName), new UnaryExpression(
                this.location, "*", new Identifier(this.location, basePtrVarName),
            )).codegen(ctx);
        recycleExpressionResult(ctx, this, assignSizeExpr);

        if (rightType.elementType instanceof ClassType) {
            // call dtor
            const dtorName = "~" + rightType.elementType.name;
            const callee = new Identifier(this.location, dtorName);
            getForLoop(new Identifier(this.location, sizeVarName), (i) => ([
                new ExpressionStatement(this.location,
                    new CallExpression(this.location, new MemberExpression(
                        this.location, new BinaryExpression(this.location, "+",
                            new Identifier(this.location, ptrVarName),
                            i), true, callee,
                    ), []))]), this).codegen(ctx);

        }

        // free(basePtr)
        new ExpressionStatement(this.location, new CallExpression(
            this.location, new Identifier(this.location, "::free"),
            [new Identifier(this.location, basePtrVarName)],
        )).codegen(ctx);
    } else {
        if (rightType.elementType instanceof ClassType) {
            const tmpVarName = ctx.scopeManager.allocTmpVarName();
            const tmpVar = new Variable(tmpVarName, tmpVarName, this.location.fileName, rightType,
                AddressType.STACK, ctx.memory.allocStack(rightType.length));
            ctx.scopeManager.define(tmpVarName, tmpVar, this);

            new AssignmentExpression(this.location, "=",
                new Identifier(this.location, tmpVarName), this.expr).codegen(ctx);

            new ExpressionStatement(this.location, new CallExpression(this.location,
                new MemberExpression(this.location, new Identifier(this.location, tmpVarName),
                    true, new Identifier(this.location, "~" + rightType.elementType.name)),
                [])).codegen(ctx);

            new ExpressionStatement(this.location, new CallExpression(this.location,
                new Identifier(this.location, "::free"), [
                    new Identifier(this.location, tmpVarName),
                ])).codegen(ctx);
        } else {
            new ExpressionStatement(this.location, new CallExpression(
                this.location, new Identifier(this.location, "::free"),
                [this.expr],
            )).codegen(ctx);
        }
    }
    return {
        type: PrimitiveTypes.void,
        isLeft: true,
        expr: new WConst(WType.none, "1", this.location),
    };
};

export function functions() {
    return "";
}
