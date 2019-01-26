import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, SourceLocation} from "../../common/node";
import {ClassTemplate, FunctionTemplate} from "../../common/template";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {UnresolvedFunctionOverloadType} from "../../type/function_type";
import {TemplateParameterPlaceHolderType} from "../../type/template_type";
import {ClassSpecifier} from "../class/class_specifier";
import {CompileContext} from "../context";
import {FunctionDefinition} from "../function/function_definition";
import {ParameterDeclaration} from "../function/parameter_declaration";
import {getShortName} from "../scope";
import {deduceFunctionTemplateParameters} from "./template_deduce";
import {TemplateParameterDeclaration, TypeParameter} from "./type_parameter";

export class TemplateDeclaration extends ClassDirective {
    public decl: ClassSpecifier | FunctionDefinition;
    public args: TemplateParameterDeclaration[];

    constructor(location: SourceLocation, decl: ClassSpecifier | FunctionDefinition,
                args: TemplateParameterDeclaration[]) {
        super(location);
        this.decl = decl;
        this.args = args;
    }

    public getTemplateNames(): string[] {
        if (this.decl instanceof FunctionDefinition) {
            return [this.decl.declarator.getNameRequired().getLastID().name];
        } else {
            return [this.decl.identifier.getLastID().name];
        }
    }

    public declareFunctionTemplateSpecialization(ctx: CompileContext): void {
        if (!(this.decl instanceof FunctionDefinition)) {
            throw new InternalError(`declareFunctionTemplateSpecialization(ctx: CompileContext): void {`);
        }
        const name = this.decl.declarator.getNameRequired();
        const lookupType = name.deduceType(ctx);
        if (!(lookupType instanceof UnresolvedFunctionOverloadType)) {
            throw new SyntaxError(`${name.getLookupName(ctx)} is not a function template`, this);
        }
        const functionType = this.decl.deduceType(ctx);
        const lookupResult = lookupType.functionLookupResult;
        for (const item of lookupResult.functions) {
            if (item instanceof FunctionTemplate) {
                const params = deduceFunctionTemplateParameters(item, functionType,
                    lookupResult.templateArguments, false);
                if (params !== null) {
                    // match_successful point;
                    const signature = lookupResult.templateArguments.map((x) => x.toString()).join(",");
                    if (item.specializationMap.has(signature)) {
                        throw new SyntaxError("duplication Specialization", this);
                    }
                    item.specializationMap.set(signature, this.decl);
                    return;
                }
            }
        }
        throw new SyntaxError(`no matched function template`, this);
    }

    public declareFunctionTemplate(ctx: CompileContext): void {
        if (!(this.decl instanceof FunctionDefinition)) {
            throw new InternalError(`public declareFunctionTemplate(ctx: CompileContext): void {`);
        }
        const savedContext = ctx.scopeManager.currentContext;
        const classType = savedContext.scope.classType;
        ctx.scopeManager.enterUnnamedScope(true);
        this.loadTemplateParameters(ctx);
        const config = classType === null ?
            this.decl.getFunctionConfig(ctx) :
            this.decl.getMemberFunctionConfig(ctx, classType);
        const realName = getShortName(config.name) + "@" + config.functionType.toMangledName();
        const fullName = ctx.scopeManager.getFullName(realName);
        const functionTemplate = new FunctionTemplate(
            realName, fullName, config,
            this.args.map((x) => x.getTemplateParameter(ctx)),
            this.decl,
            savedContext,
            classType ? classType.accessControl : AccessControl.Public,
        );
        ctx.scopeManager.detachCurrentScope();
        ctx.scopeManager.exitScope();
        ctx.scopeManager.define(functionTemplate.getIndexName(), functionTemplate, this);
    }

    public declareClassTemplateSpecialization(ctx: CompileContext): void {
        // TODO:: to impl
        throw new InternalError(`ClassSpecifier LENGTH=0`);
    }

    public declareClassTemplate(ctx: CompileContext): void {
        if (!(this.decl instanceof ClassSpecifier)) {
            throw new InternalError(` public declareClassTemplate(ctx: CompileContext): void `);
        }
        const savedContext = ctx.scopeManager.currentContext;
        const classType = savedContext.scope.classType;
        ctx.scopeManager.enterUnnamedScope(true);
        this.loadTemplateParameters(ctx);
        const realName = this.decl.identifier.getShortName(ctx);
        const fullName = this.decl.identifier.getFullName(ctx);
        const classTemplate = new ClassTemplate(
            realName, fullName, ctx.fileName,
            this.args.map((x) => x.getTemplateParameter(ctx)),
            this.decl,
            savedContext,
            classType ? classType.accessControl : AccessControl.Public,
        );
        ctx.scopeManager.detachCurrentScope();
        ctx.scopeManager.exitScope();
        ctx.scopeManager.define(realName, classTemplate, this);
    }

    public codegen(ctx: CompileContext): void {
        if (ctx.scopeManager.currentContext.scope.classType) {
            return; // skip in class
        }
        if (this.args.length === 0) {
            if (this.decl instanceof ClassSpecifier) {
                this.declareClassTemplateSpecialization(ctx);
            } else {
                this.declareFunctionTemplateSpecialization(ctx);
            }
            return;
        } else {
            if (this.decl instanceof ClassSpecifier) {
                this.declareClassTemplate(ctx);
            } else {
                this.declareFunctionTemplate(ctx);
            }
        }
    }

    public loadTemplateParameters(ctx: CompileContext) {
        for (let i = 0; i < this.args.length; i++) {
            const arg = this.args[i];
            if (arg instanceof ParameterDeclaration) {
                ctx.scopeManager.define(arg.getName(ctx), arg.getType(ctx), this);
            } else if (arg instanceof TypeParameter) {
                ctx.scopeManager.define(arg.name.getPlainName(ctx),
                    new TemplateParameterPlaceHolderType(i), this);
            } else {
                throw new InternalError(`unreachable`);
            }
        }
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        if (this.args.length === 0) {
            if (this.decl instanceof ClassSpecifier) {
                this.declareClassTemplateSpecialization(ctx);
            } else {
                this.declareFunctionTemplateSpecialization(ctx);
            }
            return;
        } else {
            if (this.decl instanceof ClassSpecifier) {
                this.declareClassTemplate(ctx);
            } else {
                this.declareFunctionTemplate(ctx);
            }
        }
    }

}
