import * as Long from "long";
import {SyntaxError, TypeError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {AddressType, FunctionEntity} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType, PointerType} from "../../type/compound_type";
import {FunctionType, UnresolvedFunctionOverloadType} from "../../type/function_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {I32Binary, WBinaryOperation, WCall, WConst, WLoad, WType} from "../../wasm";
import {WCallIndirect, WFakeExpression, WGetGlobal, WMemoryLocation} from "../../wasm/expression";
import {WExpression, WStatement} from "../../wasm/node";
import {WSetGlobal} from "../../wasm/statement";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {doConversion, doTypePromote, doTypeTransfrom, doValuePromote, getInStackSize} from "../conversion";
import {AnonymousExpression} from "../expression/anonymous_expression";
import {Expression, ExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {IntegerConstant} from "../expression/integer_constant";
import {UnaryExpression} from "../expression/unary_expression";
import {doFunctionOverloadResolution, isFunctionExists} from "../overload";
import {FunctionLookUpResult} from "../scope";

export class CallExpression extends Expression {
    public callee: Expression;
    public arguments: Expression[];

    constructor(location: SourceLocation, callee: Expression, myArguments: Expression[]) {
        super(location);
        this.callee = callee;
        this.arguments = myArguments;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const callee = this.callee.codegen(ctx);

        if (callee.type instanceof PointerType) {
            callee.type = callee.type.elementType;
        }

        let funcType: FunctionType;
        let funcEntity: FunctionEntity | null = null;

        const lookUpResult = callee.expr;
        const thisPtrs: ExpressionResult[] = [];

        let isVCall = false, VCallExpr: WExpression | null = null;

        if (lookUpResult instanceof FunctionLookUpResult) {

            const funcs = lookUpResult.functions.filter((x) => x instanceof FunctionEntity) as FunctionEntity[];
            let entity: FunctionEntity | null = funcs.length === 0 ? null : funcs[0]!;

            if (ctx.isCpp()) {
                entity = doFunctionOverloadResolution(ctx, lookUpResult,
                    this.arguments.map((x) => doTypeTransfrom(x.deduceType(ctx))), this);
            }

            if (entity === null) {
                throw new SyntaxError(`no matching function for ${lookUpResult.functions[0].shortName}`, this);
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
                if (funcType.isVirtual && lookUpResult.isDynamicCall) {
                    isVCall = true;
                    const vcallSigature = funcEntity.shortName + "@" + funcEntity.type.parameterTypes
                        .slice(1).map((x) => x.toString()).join(",");

                    const ret = lookUpResult.instanceType.getVCallInfo(vcallSigature);
                    if ( ret === null) {
                        throw new SyntaxError(`${funcEntity.shortName} is not a virtual function`, this);
                    }
                    const [vPtrOffset, vFuncOffset] = ret;
                    const vTableExpr = new WLoad(WType.i32, new WBinaryOperation(
                        I32Binary.add,
                        lookUpResult.instance.createLoadAddress(ctx),
                        new WConst(WType.i32, vPtrOffset.toString(), this.location),
                        this.location), WMemoryLocation.RAW, this.location);
                    VCallExpr = new WLoad(WType.i32, new WBinaryOperation(
                        I32Binary.add,
                        vTableExpr,
                        new WConst(WType.i32, vFuncOffset.toString(), this.location),
                        this.location), WMemoryLocation.RAW, this.location);
                }
            }
        } else if (callee.type instanceof FunctionType) {
            funcType = callee.type;
        } else {
            throw new SyntaxError(`you can just call a function, not a ${callee.type.toString()}`, this);
        }
        // lookup end

        // Compute stack offset in advance
        let stackSize = 0;
        const arguExprTypes = [...thisPtrs.map((x) => x.type),
            ... this.arguments.map((x) => x.deduceType(ctx))];
        if (funcType.variableArguments) {
            for (let i = arguExprTypes.length - 1; i > funcType.parameterTypes.length - 1; i--) {
                const src = arguExprTypes[i];
                if (src instanceof ClassType) {
                    throw new SyntaxError(`class type could not be variable arguments`, this);
                }
                const newSrc = doTypePromote(ctx, src, this);
                stackSize += getInStackSize(newSrc.length);
            }
        }
        for (let i = funcType.parameterTypes.length - 1; i >= 0; i--) {
            let dstType = funcType.parameterTypes[i];
            if (dstType instanceof ArrayType) {
                dstType = new PointerType(dstType.elementType);
            }
            if (dstType instanceof ClassType) {
                stackSize += getInStackSize(dstType.length);
            } else {
                if (funcType.variableArguments) {
                    stackSize += getInStackSize(dstType.length);
                }
            }
        }
        // compute finish

        ctx.memory.currentState.stackPtr -= stackSize;
        const arguExprs = [...thisPtrs, ... this.arguments.map((x) => x.codegen(ctx))];
        ctx.memory.currentState.stackPtr += stackSize;

        if (funcEntity && funcType.parameterTypes.length > arguExprs.length) {
            // could be default parameters
            for (let i = arguExprs.length; i < funcType.parameterTypes.length; i++) {
                const init = funcEntity.parameterInits[i];
                if (init !== null) {
                    arguExprs.push({
                        type: funcType.parameterTypes[i],
                        expr: new WConst(funcType.parameterTypes[i].toWType(),
                            init, this.location),
                        isLeft: false,
                    });
                } else {
                    throw new SyntaxError(`function call parameters number mismatch`, this);
                }
            }
        }

        const argus: WExpression[] = [];
        let stackOffset = ctx.memory.currentState.stackPtr;

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
                const fullName = dstType.fullName + "::#" + dstType.shortName;
                let expr: ExpressionResult;
                if (isFunctionExists(ctx, fullName, [leftPtrType, rightType], null)) {
                    expr = new CallExpression(this.location,
                        Identifier.fromString(this.location, fullName),
                        [left, right]).codegen(ctx);
                } else {
                    const len = dstType.length;
                    expr = new CallExpression(this.location, Identifier.fromString(this.location, "::memcpy"), [
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

        if (isVCall) {
            ctx.requiredWASMFuncTypes.add(funcType.toWASMEncoding()); // require by wasm
            funcExpr = new WCallIndirect(VCallExpr as WExpression,
                funcType.toWASMEncoding(), argus, afterStatements, this.location);
        } else if (funcEntity === null) {
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
    }

    public deduceType(ctx: CompileContext): Type {
        const calleeType = this.callee.deduceType(ctx);

        if (calleeType instanceof PointerType && calleeType.elementType instanceof FunctionType) {
            return calleeType.elementType.returnType;
        }

        if (!(calleeType instanceof UnresolvedFunctionOverloadType)) {
            throw new TypeError(`the callee is not function`, this);
        }
        const lookUpResult = calleeType.functionLookupResult;

        const funcs = lookUpResult.functions.filter((x) => x instanceof FunctionEntity) as FunctionEntity[];
        let entity: FunctionEntity | null = funcs.length === 0 ? null : funcs[0]!;

        if ( ctx.isCpp() ) {
            entity = doFunctionOverloadResolution(ctx, lookUpResult,
                this.arguments.map((x) => x.deduceType(ctx)), this);
        }

        if (entity === null ) {
            throw new SyntaxError(`no matching function for ${lookUpResult.functions[0].shortName}`, this);
        }

        return entity.type.returnType;
    }
}
