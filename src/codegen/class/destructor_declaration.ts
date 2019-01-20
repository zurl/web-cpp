import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, Directive, Node, SourceLocation} from "../../common/node";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {CppFunctionType, FunctionType} from "../../type/function_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {UnaryExpression} from "../expression/unary_expression";
import {CallExpression} from "../function/call_expression";
import {declareFunction, defineFunction, FunctionConfig} from "../function/function";
import {isFunctionExists} from "../overload";
import {CompoundStatement} from "../statement/compound_statement";
import {ExpressionStatement} from "../statement/expression_statement";
import {Statement} from "../statement/statement";
import {MemberExpression} from "./member_expression";

export class DestructorDeclaration extends ClassDirective {
    public name: Identifier;
    public body: CompoundStatement | null;
    public isVirtual: boolean;

    constructor(location: SourceLocation, name: Identifier, body: CompoundStatement | null, isVirtual: boolean) {
        super(location);
        this.name = name;
        this.body = body;
        this.isVirtual = isVirtual;
    }

    public getFunctionConfig(ctx: CompileContext, classType: ClassType, accessControl: AccessControl): FunctionConfig {
        const name = this.name.getPlainName(ctx);
        if (classType.shortName !== name) {
            throw new SyntaxError(`invaild dtor name ${name}`, this);
        }
        const parameterTypes = [new PointerType(classType)];
        const parameterNames = ["this"];
        const parameterInits = [null];
        const functionType = new FunctionType(PrimitiveTypes.void, parameterTypes, false);
        functionType.cppFunctionType = CppFunctionType.Destructor;
        functionType.referenceClass = classType;
        const indexName = "~";
        const fullName = ctx.scopeManager.getFullName("~" + name) + "@" + functionType.toMangledName();
        if (this.isVirtual) {
            functionType.isVirtual = true;
            classType.registerVFunction(ctx, indexName, fullName);
        } else {
            if (classType.getVCallInfo(indexName) !== null) {
                functionType.isVirtual = true;
                classType.registerVFunction(ctx, indexName, fullName);
            }
        }
        return {
            name: "~" + name,
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
            const body: Directive[] = [...this.body.body, ...this.generateStatements(ctx, functionConfig)];
            defineFunction(ctx, functionConfig, body, this);
        } else {
            declareFunction(ctx, functionConfig, this);
        }
    }

    private generateStatements(ctx: CompileContext, functionConfig: FunctionConfig): Statement[] {
        const emptyLocation = Node.getEmptyLocation();

        if (functionConfig.functionType.cppFunctionType !== CppFunctionType.Destructor
            || functionConfig.functionType.referenceClass === null) {
            throw new InternalError(`getDtorStmts()`);
        }

        const dtorStmts = [] as Statement[];

        const classType = functionConfig.functionType.referenceClass!;

        for (const field of classType.fields) {
            const left = new MemberExpression(emptyLocation, Identifier.fromString(emptyLocation, "this"),
                true, Identifier.fromString(emptyLocation, field.name));
            if (field.type instanceof ClassType) {
                const name = classType.fullName + "~" + classType.shortName;
                if (isFunctionExists(ctx, name, [], classType)) {
                    dtorStmts.push(new ExpressionStatement(emptyLocation,
                        new CallExpression(emptyLocation,
                            Identifier.fromString(emptyLocation, name),
                            [new UnaryExpression(emptyLocation, "&", left)],
                        )));
                }
            }
        }

        for (const item of classType.inheritance) {
            const fullName = item.classType.fullName + "::~" + item.classType.shortName;
            const nret = ctx.scopeManager.lookup(fullName);
            if (nret !== null) {
                dtorStmts.push(new ExpressionStatement(emptyLocation,
                    new CallExpression(emptyLocation,
                        new MemberExpression(emptyLocation,
                            Identifier.fromString(emptyLocation, "this"),
                            true, Identifier.fromString(emptyLocation, "~" + item.classType.shortName)),
                        [])));
            }
        }

        return dtorStmts;
    }

}
