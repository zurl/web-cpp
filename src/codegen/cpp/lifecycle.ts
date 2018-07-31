/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 22/07/2018
 */
import {
    AssignmentExpression, CallExpression,
    CompoundStatement,
    Expression, ExpressionStatement,
    Identifier,
    MemberExpression,
    Node, ObjectInitializer,
    Statement, UnaryExpression,
} from "../../common/ast";
import {SyntaxError} from "../../common/error";
import {InternalError} from "../../common/error";
import {
    ClassType,
    CppFunctionType,
    FunctionEntity,
    FunctionType,
    PointerType,
    PrimitiveTypes,
    Variable,
} from "../../common/type";
import {CompileContext} from "../context";
import {defineFunction} from "../function";
import {FunctionLookUpResult} from "../scope";
import {recycleExpressionResult} from "../statement";
import {isFunctionExists} from "./overload";

export function getCtorStmts(ctx: CompileContext,
                             entity: FunctionEntity,
                             node: Node): Statement[] {
    if (entity.type.cppFunctionType !== CppFunctionType.Constructor
        || entity.type.referenceClass === null) {
        throw new InternalError(`getCtorStmts()`);
    }

    const classType = entity.type.referenceClass;
    const initList = entity.type.initList;
    const initMap = new Map<string, Expression>();
    const ctorStmts = [] as Statement[];

    // prepreprocess initList
    for (const initItem of initList) {
        const key = initItem.key.value;
        if (classType.fieldMap.get(key) !== undefined) {
            initMap.set(key, initItem.value);
        } else {
            throw new SyntaxError(`unknown field ${key} in class ${classType.name}`, node);
        }
    }

    for (const field of classType.fields) {
        const left = new MemberExpression(node.location, new Identifier(node.location, "this"),
            true, new Identifier(node.location, field.name));
        if (initMap.get(field.name) !== undefined) {
            ctorStmts.push(new ExpressionStatement(node.location,
                new AssignmentExpression(node.location, "=",
                    left, initMap.get(field.name)!)));
        } else if (field.initializer !== null) {
            if (field.initializer instanceof ObjectInitializer) {
                if (!(field.type instanceof ClassType)) {
                    throw new SyntaxError(`only class type could apply object initializer`, node);
                }
                const ctorName = field.type.fullName + "::#" + field.type.name;
                const callee = new Identifier(node.location, ctorName);
                const thisPtr = new UnaryExpression(node.location, "&",
                    left);
                const expr = new CallExpression(node.location, callee, [thisPtr, ...field.initializer.argus]);
                ctorStmts.push(new ExpressionStatement(node.location, expr));
            } else {
                ctorStmts.push(new ExpressionStatement(node.location,
                    new AssignmentExpression(node.location, "=",
                        left, field.initializer)));
            }
        } else {
            if (field.type instanceof ClassType) {
                const name = classType.fullName + "#" + classType.name;
                if (isFunctionExists(ctx, name, [new PointerType(classType)])) {
                    ctorStmts.push(new ExpressionStatement(node.location,
                        new CallExpression(node.location,
                            new Identifier(node.location, name),
                            [new UnaryExpression(node.location, "&", left)],
                        )));
                }
            }
        }
    }

    return ctorStmts;
}

export function getDtorStmts(ctx: CompileContext,
                             entity: FunctionEntity,
                             node: Node): Statement[] {
    if (entity.type.cppFunctionType !== CppFunctionType.Destructor
        || entity.type.referenceClass === null) {
        throw new InternalError(`getDtorStmts()`);
    }
    const dtorStmts = [] as Statement[];

    const classType = entity.type.referenceClass!;

    for (const field of classType.fields) {
        const left = new MemberExpression(node.location, new Identifier(node.location, "this"),
            true, new Identifier(node.location, field.name));
        if (field.type instanceof ClassType) {
            const name = classType.fullName + "~" + classType.name;
            if (isFunctionExists(ctx, name, [], classType)) {
                dtorStmts.push(new ExpressionStatement(node.location,
                    new CallExpression(node.location,
                        new Identifier(node.location, name),
                        [new UnaryExpression(node.location, "&", left)],
                    )));
            }
        }
    }

    return dtorStmts;
}

export function triggerDestructor(ctx: CompileContext, obj: Variable, node: Node) {
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
        new CallExpression(node.location,
            new MemberExpression(node.location, new Identifier(node.location, obj.name),
                false, new Identifier(node.location, "~" + classType.name)), [],
        ).codegen(ctx));

}

export function generateDefaultCtors(ctx: CompileContext,
                                     classType: ClassType,
                                     node: Node) {
    // 1. default ctor
    const defaultCtorRet = ctx.scopeManager
        .lookupFullName(classType.fullName + "::#" + classType.name);
    if (defaultCtorRet === null || !(defaultCtorRet instanceof FunctionLookUpResult)) {
        const shortName = "#" + classType.name;
        const funcType = new FunctionType(shortName, PrimitiveTypes.void,
            [new PointerType(classType)], ["this"], false);
        funcType.cppFunctionType = CppFunctionType.Constructor;
        funcType.referenceClass = classType;
        defineFunction(ctx, funcType, shortName, [], node);
    }

    // 2. copy ctor

    // TODO:: generate default copy constructor!

}
