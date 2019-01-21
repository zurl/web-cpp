import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {AccessControl, Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType} from "../../type/compound_type";
import {FunctionType} from "../../type/function_type";
import {CompileContext} from "../context";
import {AssignmentExpression} from "../expression/assignment_expression";
import {Expression, recycleExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {UnaryExpression} from "../expression/unary_expression";
import {CallExpression} from "../function/call_expression";
import {declareFunction} from "../function/function";
import {Declarator} from "./declarator";
import {FunctionDeclarator} from "./function_declarator";
import {InitializerList} from "./initializer_list";
import {ObjectInitializer} from "./object_initializer";

export interface SpecifierInfo {
    type: Type;
    isLibCall: boolean;
    isExtern: boolean;
    isStatic: boolean;
}

export class InitDeclarator extends Node {
    public declarator: Declarator;
    public initializer: Expression | ObjectInitializer | InitializerList | null;

    constructor(location: SourceLocation, declarator: Declarator,
                initializer: Expression | ObjectInitializer | InitializerList | null) {
        super(location);
        this.declarator = declarator;
        this.initializer = initializer;
    }

    public initialize(ctx: CompileContext, info: SpecifierInfo) {
        const type = this.declarator.getType(ctx, info.type);
        const name = this.declarator.getNameRequired();
        const shortName = name.getShortName(ctx);
        if (this.initializer != null) {
            if (info.isExtern) {
                throw new SyntaxError(`extern vaiable could not have initializer`, this);
            }
            if (this.initializer instanceof InitializerList) {
                this.initializer.initialize(ctx, name, type);
            } else if (this.initializer instanceof ObjectInitializer) {
                this.initializer.initialize(ctx, name, type);
            } else {
                const expr = new AssignmentExpression(this.location, "=",
                    Identifier.fromString(this.location, shortName),
                    this.initializer);
                expr.isInitExpr = true;
                recycleExpressionResult(ctx, this, expr.codegen(ctx));
            }
        } else if (type instanceof ClassType) {
            const ctorName = type.fullName + "::#" + type.shortName;
            const callee = Identifier.fromString(this.location, ctorName);
            const thisPtr = new UnaryExpression(this.location, "&",
                Identifier.fromString(this.location, shortName));
            const expr = new CallExpression(this.location, callee, [thisPtr]);
            recycleExpressionResult(ctx, this, expr.codegen(ctx));
        }
    }

    public createVariable(ctx: CompileContext, info: SpecifierInfo): Variable {
        const name = this.declarator.getNameRequired();
        const shortName = name.getShortName(ctx);
        const fullName = name.getFullName(ctx);
        const type = this.declarator.getType(ctx, info.type);
        let storageType = AddressType.STACK;
        let location: number | string = 0;

        if (ctx.scopeManager.isRoot() || info.isStatic) {
            if (info.isExtern) {
                storageType = AddressType.MEMORY_EXTERN;
                location = fullName;
            } else if (this.initializer !== null && !(type instanceof ArrayType)) {
                storageType = AddressType.MEMORY_DATA;
                location = ctx.memory.allocData(type.length);
            } else {
                storageType = AddressType.MEMORY_BSS;
                location = ctx.memory.allocBss(type.length);
            }
        } else {
            if (info.isExtern) {
                throw new SyntaxError("local variable could not be extern:  " + name, this);
            }
            // TODO:: support static function variable;
            storageType = AddressType.STACK;
            location = ctx.memory.allocStack(type.length);
        }
        return new Variable(
            shortName, fullName, ctx.fileName,
            type, storageType, location);
    }

    public declareGlobal(ctx: CompileContext, info: SpecifierInfo, lookupName: string) {
        const type = this.declarator.getType(ctx, info.type);

        if (type instanceof ClassType && !type.isComplete) {
            throw new SyntaxError(`cannot instance incomplete type`, this);
        }

        if (type instanceof FunctionType) {
            const functionDeclarator = FunctionDeclarator.getFunctionDeclarator(this.declarator);
            if (!functionDeclarator) {
                throw new InternalError(`function is not a functionDeclarator`);
            }
            declareFunction(ctx, {
                name: lookupName,
                functionType: type,
                parameterNames: functionDeclarator.parameters.getNameList(ctx),
                parameterInits: functionDeclarator.parameters.getInitList(ctx),
                accessControl: AccessControl.Public,
                isLibCall: info.isLibCall,
            }, this);
        } else {
            if (ctx.scopeManager.currentContext.scope.classType
                && !info.isStatic) {
                // if in class, we should skip
                return;
            }
            const newItem = this.createVariable(ctx, info);
            if (info.isExtern) {
                ctx.scopeManager.declare(lookupName, newItem, this);
            } else {
                ctx.scopeManager.define(lookupName, newItem, this);
            }
        }
    }

    public declare(ctx: CompileContext, info: SpecifierInfo) {
        const name = this.declarator.getNameRequired();
        const lookupName = name.getLookupName(ctx);
        this.declareGlobal(ctx, info, lookupName);
        if (this.initializer) {
            this.initialize(ctx, info);
        }
    }

    public declareInClass(ctx: CompileContext, info: SpecifierInfo, classType: ClassType) {
        const type = this.declarator.getType(ctx, info.type);
        const name = this.declarator.getNameRequired();
        const lookupName = name.getLookupName(ctx);
        if (info.isStatic ) {
            info.isExtern = true; // we only declare hereby
            this.declareGlobal(ctx, info, lookupName);
            if (this.initializer) {
                throw new SyntaxError(`the static field could only be initialize outside the class`, this);
            }
        } else {
            const plainName = name.getPlainName(ctx);
            if (this.initializer instanceof InitializerList) {
                // todo::
                throw new SyntaxError(`unsupport initial list`, this);
            }
            const oldField = classType.fields.filter((field) => field.name === plainName);
            if (oldField.length) {
                throw new SyntaxError(`duplicated field name ${plainName}`, this);
            }
            classType.fields.push({
                name: plainName,
                type,
                startOffset: classType.fieldOffset,
                initializer: this.initializer,
                accessControl: classType.accessControl,
            });
            if (!classType.isUnion) {
                classType.fieldOffset += type.length;
            }
        }
    }
}
