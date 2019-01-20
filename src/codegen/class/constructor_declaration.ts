import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, Directive, Node, SourceLocation} from "../../common/node";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {CppFunctionType, FunctionType} from "../../type/function_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WGetAddress, WMemoryLocation} from "../../wasm/expression";
import {CompileContext} from "../context";
import {ObjectInitializer} from "../declaration/object_initializer";
import {ParameterList} from "../declaration/parameter_list";
import {AnonymousExpression} from "../expression/anonymous_expression";
import {AssignmentExpression} from "../expression/assignment_expression";
import {BinaryExpression} from "../expression/binary_expression";
import {Expression} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {IntegerConstant} from "../expression/integer_constant";
import {UnaryExpression} from "../expression/unary_expression";
import {CallExpression} from "../function/call_expression";
import {declareFunction, defineFunction, FunctionConfig} from "../function/function";
import {isFunctionExists} from "../overload";
import {FunctionLookUpResult} from "../scope";
import {CompoundStatement} from "../statement/compound_statement";
import {ExpressionStatement} from "../statement/expression_statement";
import {Statement} from "../statement/statement";
import {MemberExpression} from "./member_expression";

export class ConstructorDeclaration extends ClassDirective {
    public name: Identifier;
    public param: ParameterList;
    public initList: ConstructorInitializeItem[];
    public body: CompoundStatement | null;

    constructor(location: SourceLocation, name: Identifier, param: ParameterList,
                initList: ConstructorInitializeItem[], body: CompoundStatement | null) {
        super(location);
        this.name = name;
        this.param = param;
        this.initList = initList;
        this.body = body;
    }

    public getFunctionConfig(ctx: CompileContext, classType: ClassType, accessControl: AccessControl): FunctionConfig {
        const name = this.name.getPlainName(ctx);
        if (classType.shortName !== name) {
            throw new SyntaxError(`invaild ctor name ${name}`, this);
        }
        const parameterTypes = [new PointerType(classType), ...this.param.getTypeList(ctx)];
        const parameterNames = ["this", ...this.param.getNameList(ctx)];
        const parameterInits = [null, ...this.param.getInitList(ctx)];
        const functionType = new FunctionType(PrimitiveTypes.void, parameterTypes, false);
        functionType.cppFunctionType = CppFunctionType.Constructor;
        functionType.referenceClass = classType;
        return {
            name: "#" + name,
            functionType,
            parameterNames,
            parameterInits,
            accessControl,
            isLibCall: false,
        };
    }

    public declare(ctx: CompileContext, classType: ClassType) {
        const functionConfig = this.getFunctionConfig(ctx, classType, classType.accessControl);
        declareFunction(ctx, functionConfig, this);
    }

    public codegen(ctx: CompileContext) {
        const classType = ctx.scopeManager.lookup(this.name.getLookupName(ctx));
        if (!classType) {
            throw new SyntaxError(`unresolved name ${this.name.getLookupName(ctx)}`, this);
        }
        if (!(classType instanceof ClassType)) {
            throw new SyntaxError(`name ${this.name.getLookupName(ctx)} is not a class`, this);
        }
        const functionConfig = this.getFunctionConfig(ctx, classType, AccessControl.Unknown);
        if (this.body) {
            const body: Directive[] = [...this.generateStatements(ctx, functionConfig), ...this.body.body];
            defineFunction(ctx, functionConfig, body, this);
        } else {
            declareFunction(ctx, functionConfig, this);
        }
    }

    private generateStatements(ctx: CompileContext, functionConfig: FunctionConfig): Statement[] {
        const emptyLocation = Node.getEmptyLocation();

        if (functionConfig.functionType.cppFunctionType !== CppFunctionType.Constructor
            || functionConfig.functionType.referenceClass === null) {
            throw new InternalError(`getCtorStmts()`);
        }

        const classType = functionConfig.functionType.referenceClass;
        const initList = this.initList;
        const initMap = new Map<string, Expression>();
        const baseStatements = [] as Statement[];

        // prepreprocess initList
        for (const initItem of initList) {
            if (!initItem.isType) {
                // base class ctor
                const key = initItem.key.getPlainName(ctx);
                if (initItem.value.length !== 1) {
                    throw new SyntaxError(`the number of argument to init `
                        + key + ` is incorrect, exepct 1, actual ${initItem.value.length}`, this);
                }
                if (classType.getField(key) !== null) {
                    initMap.set(key, initItem.value[0]);
                } else {
                    throw new SyntaxError(`unknown field ${key} in class ${classType.shortName}`, this);
                }
            } else {
                // field init
                const key = initItem.key.getPlainName(ctx);
                let hasFound = false;
                for (let i = 0; i < classType.inheritance.length; i++) {
                    if (testMatchClassName(
                        classType.inheritance[i].classType.fullName,
                        classType.fullName,
                        key)) {
                        const baseType = classType.inheritance[i].classType;
                        const fullName = baseType.fullName + "::#" + baseType.shortName;
                        const nret = ctx.scopeManager.lookup(fullName);
                        if (nret === null || !(nret instanceof FunctionLookUpResult)) {
                            throw new SyntaxError(`the base class ${initItem.key.name}` +
                                ` construtor parameters mismatch`, this);
                        }
                        baseStatements[i] = new ExpressionStatement(emptyLocation,
                            new CallExpression(emptyLocation,
                                Identifier.fromString(emptyLocation, fullName),
                                [
                                    Identifier.fromString(emptyLocation, "this"),
                                    ...initItem.value,
                                ]));
                        hasFound = true;
                    }
                }
                if (!hasFound) {
                    throw new SyntaxError(`class ${initItem.key.name}` +
                        ` is not base class of ${classType.shortName}`, this);
                }
            }
        }

        // default base class init
        for (let i = 0; i < classType.inheritance.length; i++) {
            if ( !baseStatements[i]) {
                const baseType = classType.inheritance[i].classType;
                const fullName = baseType.fullName + "::#" + baseType.shortName;
                const nret = ctx.scopeManager.lookup(fullName);
                if (nret === null || !(nret instanceof FunctionLookUpResult)) {
                    throw new SyntaxError(`the base class ${baseType.shortName}` +
                        ` contains not constructor`, this);
                }
                baseStatements[i] = new ExpressionStatement(emptyLocation,
                    new CallExpression(emptyLocation,
                        Identifier.fromString(emptyLocation, fullName),
                        [
                            Identifier.fromString(emptyLocation, "this"),
                        ]));
            }
        }
        const statements = [ ...baseStatements ] as Statement[];

        for (const field of classType.fields) {
            const left = new MemberExpression(emptyLocation, Identifier.fromString(emptyLocation, "this"),
                true, Identifier.fromString(emptyLocation, field.name));
            if (initMap.get(field.name) !== undefined) {
                statements.push(new ExpressionStatement(emptyLocation,
                    new AssignmentExpression(emptyLocation, "=",
                        left, initMap.get(field.name)!)));
            } else if (field.initializer !== null) {
                if (field.initializer instanceof ObjectInitializer) {
                    if (!(field.type instanceof ClassType)) {
                        throw new SyntaxError(`only class type could apply object initializer`, this);
                    }
                    const ctorName = field.type.fullName + "::#" + field.type.shortName;
                    const callee = Identifier.fromString(emptyLocation, ctorName);
                    const thisPtr = new UnaryExpression(emptyLocation, "&",
                        left);
                    const expr = new CallExpression(emptyLocation, callee, [thisPtr, ...field.initializer.argus]);
                    statements.push(new ExpressionStatement(emptyLocation, expr));
                } else {
                    statements.push(new ExpressionStatement(emptyLocation,
                        new AssignmentExpression(emptyLocation, "=",
                            left, field.initializer)));
                }
            } else {
                if (field.type instanceof ClassType) {
                    const name = classType.fullName + "#" + classType.shortName;
                    if (isFunctionExists(ctx, name, [new PointerType(classType)])) {
                        statements.push(new ExpressionStatement(emptyLocation,
                            new CallExpression(emptyLocation,
                                Identifier.fromString(emptyLocation, name),
                                [new UnaryExpression(emptyLocation, "&", left)],
                            )));
                    }
                }
            }
        }

        if (classType.requireVPtr) {
            const thisPtrExpr = Identifier.fromString(emptyLocation, "this").codegen(ctx);
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
            statements.push(new ExpressionStatement(emptyLocation, new AssignmentExpression(emptyLocation,
                "=", lhs, rhs,
            )));
        }

        return statements;
    }
}

export class ConstructorInitializeItem extends Node {
    public key: Identifier;
    public value: Expression[];
    public isType: boolean;

    constructor(location: SourceLocation, key: Identifier, value: Expression[], isType: boolean) {
        super(location);
        this.key = key;
        this.value = value;
        this.isType = isType;
    }
}

function testMatchClassName(fullName: string, classFullName: string, anyName: string) {
    // to test the name in init list of ctor is one of the base class of this class
    if (anyName.slice(0, 2) === "::") {
        return fullName === anyName;
    }
    const tokens = classFullName.split("::");
    const scopeName = tokens.slice(0, tokens.length - 1).join("::");
    return (scopeName + "::" + anyName) === fullName;
}
