import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, SourceLocation} from "../../common/node";
import {FunctionEntity, OverloadSymbol} from "../../common/symbol";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {PointerType} from "../../type/compound_type";
import {CppFunctionType, FunctionType} from "../../type/function_type";
import {CompileContext} from "../context";
import {Declarator} from "../declaration/declarator";
import {FunctionDeclarator} from "../declaration/function_declarator";
import {SpecifierList} from "../declaration/specifier_list";
import {FunctionLookUpResult, Scope} from "../scope";
import {CompoundStatement} from "../statement/compound_statement";
import {declareFunction, defineFunction, FunctionConfig} from "./function";

export class FunctionDefinition extends ClassDirective {
    public specifiers: SpecifierList;
    public declarator: Declarator;
    public body: CompoundStatement;
    public parameterNames: string[];

    constructor(location: SourceLocation, specifiers: SpecifierList,
                declarator: Declarator, body: CompoundStatement) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
        this.body = body;
        this.parameterNames = [];
    }

    public deduceType(ctx: CompileContext): FunctionType {
        const type = this.declarator.getType(ctx, this.specifiers.getType(ctx));
        if (!(type instanceof FunctionType)) {
            throw new InternalError(`this is not a function`);
        }
        return type;
    }

    public getFunctionConfig(ctx: CompileContext): FunctionConfig {
        const name = this.declarator.getNameRequired();
        const functionDeclarator = FunctionDeclarator.getFunctionDeclarator(this.declarator);
        const functionType = this.deduceType(ctx);
        if (!functionDeclarator) {
            throw new InternalError(`function is not a functionDeclarator`);
        }
        return {
            name: name.getLookupName(ctx),
            functionType,
            parameterNames: functionDeclarator.parameters.getNameList(ctx),
            parameterInits: functionDeclarator.parameters.getInitList(ctx),
            accessControl: AccessControl.Public,
            isLibCall: this.specifiers.specifiers.includes("__libcall"),
        };
    }

    public getMemberFunctionConfig(ctx: CompileContext, classType: ClassType): FunctionConfig {
        if (this.specifiers.specifiers.includes("static")) {
            return this.getFunctionConfig(ctx);
        }
        const name = this.declarator.getNameRequired();
        const functionType = this.deduceType(ctx);
        const functionDeclarator = FunctionDeclarator.getFunctionDeclarator(this.declarator);
        if (!functionDeclarator) {
            throw new InternalError(`function is not a functionDeclarator`);
        }
        functionType.parameterTypes = [new PointerType(classType), ...functionType.parameterTypes];
        functionType.cppFunctionType = CppFunctionType.MemberFunction;
        functionType.referenceClass = classType;
        const parameterNames = ["this", ...functionDeclarator.parameters.getNameList(ctx)];
        const parameterInits = [null, ...functionDeclarator.parameters.getInitList(ctx)];
        const isVirtual = this.specifiers.specifiers.includes("virtual");
        const fullName = name.getFullName(ctx) + "@" + functionType.toMangledName();
        const vcallSigature = name.getShortName(ctx) + "@" + functionType.parameterTypes
            .slice(1).map((x) => x.toString()).join(",");
        if (isVirtual) {
            functionType.isVirtual = true;
            classType.registerVFunction(ctx, vcallSigature, fullName);
        } else {
            if (classType.getVCallInfo(vcallSigature) !== null) {
                functionType.isVirtual = true;
                classType.registerVFunction(ctx, vcallSigature, fullName);
            }
        }
        return {
            name: name.getLookupName(ctx),
            functionType,
            parameterNames,
            parameterInits,
            accessControl: classType.accessControl,
            isLibCall: this.specifiers.specifiers.includes("__libcall"),
        };
    }

    public declare(ctx: CompileContext, classType: ClassType) {
        const config = this.getMemberFunctionConfig(ctx, classType);
        declareFunction(ctx, config, this);
    }

    public codegen(ctx: CompileContext): void {
        const name = this.declarator.getNameRequired();
        const fullName = name.getFullName(ctx);
        const scope = ctx.scopeManager.root.getScopeOfLookupName(fullName);
        if (!scope) {
            throw new SyntaxError(`unresolvedname ${fullName}`, this);
        }
        if (scope.classType === null) {
            const config = this.getFunctionConfig(ctx);
            const oldItem = ctx.scopeManager.getOldOverloadSymbol(
                fullName + "@" + config.functionType.toMangledName());
            const activeScopes = (oldItem && oldItem instanceof FunctionEntity)
                ? oldItem.declareActiveScopes : [];
            defineFunction(ctx, config, this.body.body, activeScopes, this);
        } else {
            const classType = scope.classType;
            const config = this.getMemberFunctionConfig(ctx, classType);
            const oldItem = ctx.scopeManager.getOldOverloadSymbol(
                fullName + "@" + config.functionType.toMangledName());
            const activeScopes = (oldItem && oldItem instanceof FunctionEntity)
                ? oldItem.declareActiveScopes : [];
            config.accessControl = AccessControl.Unknown;
            defineFunction(ctx, config, this.body.body, activeScopes, this);
        }
    }
}
