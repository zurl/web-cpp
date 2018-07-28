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
    Node,
    Statement, UnaryExpression,
} from "../../common/ast";
import {SyntaxError} from "../../common/error";
import {InternalError} from "../../common/error";
import {ClassType, CppFunctionType, FunctionEntity, FunctionType, PointerType, PrimitiveTypes} from "../../common/type";
import {CompileContext} from "../context";
import {FunctionLookUpResult} from "../scope";
import {isFunctionExists} from "./overload";
import {defineFunction} from "../function";

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
            ctorStmts.push(new ExpressionStatement(node.location,
                new AssignmentExpression(node.location, "=",
                    left, field.initializer)));
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

export function generateDefaultCtors(ctx: CompileContext,
                                     classType: ClassType,
                                     node: Node) {
    // 1. default ctor
    const defaultCtorRet = ctx.scopeManager
        .lookupFullName(classType.fullName + "::$" + classType.name);
    if ( defaultCtorRet === null || !(defaultCtorRet instanceof FunctionLookUpResult)) {
        const shortName = "$" + classType.name;
        const funcType = new FunctionType(shortName, PrimitiveTypes.void,
            [new PointerType(classType)], ["this"], false);
        defineFunction(ctx, funcType, shortName, [], node);
    }

}
