/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 22/07/2018
 */
import {
    AnonymousExpression,
    AssignmentExpression, BinaryExpression, CallExpression,
    Expression, ExpressionStatement,
    Identifier, IntegerConstant,
    MemberExpression,
    Node, ObjectInitializer,
    Statement, UnaryExpression,
} from "../../common/ast";
import {InternalError} from "../../common/error";
import {SyntaxError} from "../../common/error";
import {FunctionEntity, Variable} from "../../common/symbol";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {CppFunctionType, FunctionType} from "../../type/function_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WGetAddress, WMemoryLocation} from "../../wasm/expression";
import {CompileContext} from "../context";
import {defineFunction} from "../function";
import {FunctionLookUpResult} from "../scope";
import {recycleExpressionResult} from "../statement";
import {isFunctionExists} from "./overload";

function testMatchClassName(fullName: string, classFullName: string, anyName: string) {
    if (anyName.slice(0, 2) === "::") {
        return fullName === anyName;
    }
    const tokens = classFullName.split("::");
    const scopeName = tokens.slice(0, tokens.length - 1).join("::");
    return (scopeName + "::" + anyName) === fullName;
}

export function getCtorStmts(ctx: CompileContext,
                             entity: FunctionEntity,
                             node: Node): Statement[] {
    const emptyLocation = Node.getEmptyLocation();

    if (entity.type.cppFunctionType !== CppFunctionType.Constructor
        || entity.type.referenceClass === null) {
        throw new InternalError(`getCtorStmts()`);
    }

    const classType = entity.type.referenceClass;
    const initList = entity.type.initList;
    const initMap = new Map<string, Expression>();
    const baseCtorStmts = [] as Statement[];

    // prepreprocess initList
    for (const initItem of initList) {
        if (initItem.key instanceof Identifier) {
            const key = initItem.key.name;
            if (initItem.value.length !== 1) {
                throw new SyntaxError(`the number of argument to init `
                + key + ` is incorrect, exepct 1, actual ${initItem.value.length}`, node);
            }
            if (classType.getField(key) !== null) {
                initMap.set(key, initItem.value[0]);
            } else {
                throw new SyntaxError(`unknown field ${key} in class ${classType.name}`, node);
            }
        } else {
            let hasFound = false;
            for (let i = 0; i < classType.inheritance.length; i++) {
                if (testMatchClassName(
                    classType.inheritance[i].classType.fullName,
                    classType.fullName,
                    initItem.key.name)) {
                    const baseType = classType.inheritance[i].classType;
                    const fullName = baseType.fullName + "::#" + baseType.name;
                    const nret = ctx.scopeManager.lookupFullName(fullName);
                    if (nret === null || !(nret instanceof FunctionLookUpResult)) {
                        throw new SyntaxError(`the base class ${initItem.key.name}` +
                            ` construtor parameters mismatch`, node);
                    }
                    baseCtorStmts[i] = new ExpressionStatement(emptyLocation,
                        new CallExpression(emptyLocation,
                            new Identifier(emptyLocation, fullName),
                            [
                                new Identifier(emptyLocation, "this"),
                                ...initItem.value,
                            ]));
                    hasFound = true;
                }
            }
            if (!hasFound) {
                throw new SyntaxError(`class ${initItem.key.name}` +
                    ` is not base class of ${classType.name}`, node);
            }
        }
    }

    // default base class init
    for (let i = 0; i < classType.inheritance.length; i++) {
        if ( !baseCtorStmts[i]) {
            const baseType = classType.inheritance[i].classType;
            const fullName = baseType.fullName + "::#" + baseType.name;
            const nret = ctx.scopeManager.lookupFullName(fullName);
            if (nret === null || !(nret instanceof FunctionLookUpResult)) {
                throw new SyntaxError(`the base class ${baseType.name}` +
                    ` contains not constructor`, node);
            }
            baseCtorStmts[i] = new ExpressionStatement(emptyLocation,
                new CallExpression(emptyLocation,
                    new Identifier(emptyLocation, fullName),
                    [
                        new Identifier(emptyLocation, "this"),
                    ]));
        }
    }
    const ctorStmts = [ ...baseCtorStmts ] as Statement[];

    for (const field of classType.fields) {
        const left = new MemberExpression(emptyLocation, new Identifier(emptyLocation, "this"),
            true, new Identifier(emptyLocation, field.name));
        if (initMap.get(field.name) !== undefined) {
            ctorStmts.push(new ExpressionStatement(emptyLocation,
                new AssignmentExpression(emptyLocation, "=",
                    left, initMap.get(field.name)!)));
        } else if (field.initializer !== null) {
            if (field.initializer instanceof ObjectInitializer) {
                if (!(field.type instanceof ClassType)) {
                    throw new SyntaxError(`only class type could apply object initializer`, node);
                }
                const ctorName = field.type.fullName + "::#" + field.type.name;
                const callee = new Identifier(emptyLocation, ctorName);
                const thisPtr = new UnaryExpression(emptyLocation, "&",
                    left);
                const expr = new CallExpression(emptyLocation, callee, [thisPtr, ...field.initializer.argus]);
                ctorStmts.push(new ExpressionStatement(emptyLocation, expr));
            } else {
                ctorStmts.push(new ExpressionStatement(emptyLocation,
                    new AssignmentExpression(emptyLocation, "=",
                        left, field.initializer)));
            }
        } else {
            if (field.type instanceof ClassType) {
                const name = classType.fullName + "#" + classType.name;
                if (isFunctionExists(ctx, name, [new PointerType(classType)])) {
                    ctorStmts.push(new ExpressionStatement(emptyLocation,
                        new CallExpression(emptyLocation,
                            new Identifier(emptyLocation, name),
                            [new UnaryExpression(emptyLocation, "&", left)],
                        )));
                }
            }
        }
    }

    if (classType.requireVPtr) {
        const thisPtrExpr = new Identifier(emptyLocation, "this").codegen(ctx);
        thisPtrExpr.type = new PointerType(PrimitiveTypes.char);
        const vPtrExpr = new BinaryExpression(emptyLocation, "+",
            new AnonymousExpression(emptyLocation, thisPtrExpr),
            IntegerConstant.fromNumber(emptyLocation, classType.VPtrOffset)).codegen(ctx);
        vPtrExpr.type = new PointerType(PrimitiveTypes.int32);
        const lhs = new UnaryExpression(emptyLocation, "*", new AnonymousExpression(
            emptyLocation, vPtrExpr,
        ));
        const vTableAddr = new WGetAddress(WMemoryLocation.DATA, emptyLocation);
        vTableAddr.offset = classType.vTablePtr;
        const rhs = new AnonymousExpression(emptyLocation, {
            type: PrimitiveTypes.int32,
            expr: vTableAddr,
            isLeft: false,
        });
        ctorStmts.push(new ExpressionStatement(emptyLocation, new AssignmentExpression(emptyLocation,
            "=", lhs, rhs,
        )));
    }
    return ctorStmts;
}

export function getDtorStmts(ctx: CompileContext,
                             entity: FunctionEntity,
                             node: Node): Statement[] {
    const emptyLocation = Node.getEmptyLocation();
    if (entity.type.cppFunctionType !== CppFunctionType.Destructor
        || entity.type.referenceClass === null) {
        throw new InternalError(`getDtorStmts()`);
    }
    const dtorStmts = [] as Statement[];

    const classType = entity.type.referenceClass!;

    for (const field of classType.fields) {
        const left = new MemberExpression(emptyLocation, new Identifier(emptyLocation, "this"),
            true, new Identifier(emptyLocation, field.name));
        if (field.type instanceof ClassType) {
            const name = classType.fullName + "~" + classType.name;
            if (isFunctionExists(ctx, name, [], classType)) {
                dtorStmts.push(new ExpressionStatement(emptyLocation,
                    new CallExpression(emptyLocation,
                        new Identifier(emptyLocation, name),
                        [new UnaryExpression(emptyLocation, "&", left)],
                    )));
            }
        }
    }

    for (const item of classType.inheritance) {
        const fullName = item.classType.fullName + "::~" + item.classType.name;
        const nret = ctx.scopeManager.lookupFullName(fullName);
        if (nret !== null) {
            dtorStmts.push(new ExpressionStatement(emptyLocation,
                new CallExpression(emptyLocation,
                    new MemberExpression(emptyLocation,
                        new Identifier(emptyLocation, "this"),
                        true, new Identifier(emptyLocation, "~" + item.classType.name)),
                    [])));
        }
    }

    return dtorStmts;
}

export function triggerDestructor(ctx: CompileContext, obj: Variable, node: Node) {
    const emptyLocation = Node.getEmptyLocation();
    const classType = obj.type;
    if (!(classType instanceof ClassType)) {
        throw new InternalError(`triggerDestructor()`);
    }
    const fullName = classType.fullName + "::~" + classType.name;
    const dtor = ctx.scopeManager.lookupFullName(fullName);
    if (dtor === null) {
        return;
    }
    recycleExpressionResult(ctx, node,
        new CallExpression(emptyLocation,
            new MemberExpression(emptyLocation, new Identifier(emptyLocation, obj.name),
                false, new Identifier(emptyLocation, "~" + classType.name)), [],
        ).codegen(ctx));

}

export function generateDefaultCtors(ctx: CompileContext,
                                     classType: ClassType,
                                     node: Node) {
    // 1. default ctor
    const defaultCtorRet = ctx.scopeManager
        .lookupFullName(classType.fullName + "::#" + classType.name);
    if (defaultCtorRet === null) {
        const shortName = "#" + classType.name;
        const funcType = new FunctionType(shortName, PrimitiveTypes.void,
            [new PointerType(classType)], ["this"], false);
        funcType.cppFunctionType = CppFunctionType.Constructor;
        funcType.referenceClass = classType;
        funcType.name = shortName;
        defineFunction(ctx, funcType, [], AccessControl.Public, node);
    }

    // 2. default dtor
    const defaultDtorRet = ctx.scopeManager
        .lookupFullName(classType.fullName + "::~" + classType.name);
    if (defaultDtorRet === null) {
        const shortName = "~" + classType.name;
        const funcType = new FunctionType(shortName, PrimitiveTypes.void,
            [new PointerType(classType)], ["this"], false);
        funcType.cppFunctionType = CppFunctionType.Destructor;
        funcType.referenceClass = classType;
        funcType.name = shortName;
        defineFunction(ctx, funcType, [], AccessControl.Public, node);
    }

}
