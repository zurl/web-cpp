import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {AddressType, FunctionEntity, Variable} from "../../common/symbol";
import {ClassTemplate, FunctionTemplate} from "../../common/template";
import {AccessControl, Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {ArrayType} from "../../type/compound_type";
import {CppFunctionType, UnresolvedFunctionOverloadType} from "../../type/function_type";
import {WConst, WEmptyExpression, WType} from "../../wasm";
import {WAddressHolder} from "../address";
import {MemberExpression} from "../class/member_expression";
import {CompileContext} from "../context";
import {FunctionLookUpResult, LookUpResult} from "../scope";
import {instantiateClassTemplate} from "../template/class_template_instantiation";
import {TemplateArgument} from "../template/template_argument";
import {Expression, ExpressionResult} from "./expression";

export enum IDType {
    ID,
    TYPE,
    T_FUNC,
    T_FUNC_INS,
    T_CLASS,
    T_CLASS_INS,
    OPE_TYPE,
}

export class SingleIdentifier extends Node {

    public static fromString(location: SourceLocation, str: string) {
        return new SingleIdentifier(
            location, str, IDType.ID, [],
        );
    }
    public name: string;
    public type: IDType;
    public args: TemplateArgument[];

    constructor(location: SourceLocation, name: string, type: IDType, args: TemplateArgument[]) {
        super(location);
        this.name = name;
        this.type = type;
        this.args = args;
    }

    public clone(): SingleIdentifier {
        return new SingleIdentifier(this.location, this.name, this.type, this.args);
    }
}

export class Identifier extends Expression {

    public static emptyIdentifier: Identifier;

    public static fromString(location: SourceLocation, str: string, isType: boolean = false) {
        const isFullName = str.slice(0, 2) === "::";
        if (isFullName) {
            str = str.slice(2);
        }
        const result = new Identifier(location, str.split("::").map((x) => new SingleIdentifier(
            location, x, IDType.ID, [],
        )), isFullName);
        if (isType) {
            result.getLastID().type = IDType.TYPE;
        }
        return result;
    }

    public static allocTmpVar(ctx: CompileContext, type: Type, node: Node): Identifier {
        const varName = ctx.scopeManager.allocTmpVarName();
        const varEntity = new Variable(varName, varName, node.location.fileName, type,
            AddressType.STACK, ctx.memory.allocStack(type.length), AccessControl.Public);
        ctx.scopeManager.define(varName, varEntity, node);
        return Identifier.fromString(node.location, varName);
    }

    public name: SingleIdentifier[];
    public isFullName: boolean;

    constructor(location: SourceLocation, name: SingleIdentifier[], isFullName: boolean) {
        super(location);
        this.name = name;
        this.isFullName = isFullName;
    }

    public getLastID(): SingleIdentifier {
        return this.name[this.name.length - 1];
    }

    public getType(): IDType {
        return this.getLastID().type;
    }

    public clone(): Identifier {
        return new Identifier(this.location, this.name.map((x) => x.clone()), this.isFullName);
    }

    public getPlainName(ctx: CompileContext): string {
        if (!(this.name.length === 1 && (this.name[0].type === IDType.ID || this.name[0].type === IDType.TYPE))) {
            throw new SyntaxError(`${this.getLookupName(ctx)} is not a valid identifier`, this);
        }
        return this.getShortName(ctx);
    }

    public getOverloadName(ctx: CompileContext, name: string): string {
        const item = ctx.scopeManager.lookup(name);
        if (item instanceof ClassType) {
            return "#" + item.toMangledName();
        } else {
            throw new SyntaxError(`${name} is not a valid function overload type`, this);
        }
    }

    public getShortName(ctx: CompileContext): string {
        if (this.getLastID().type === IDType.OPE_TYPE) {
            return this.getOverloadName(ctx, this.getLastID().name);
        }
        return this.getLastID().name;
    }

    public getFullName(ctx: CompileContext): string {
        if (this.isFullName) {
            return this.getLookupName(ctx);
        } else {
            return ctx.scopeManager.getFullName(this.getLookupName(ctx));
        }
    }

    public fillInBlank(ctx: CompileContext, args: TemplateArgument[],
                       template: FunctionTemplate | ClassTemplate) {
        const templateArguments = args.map((x) => x.evaluate(ctx));
        while (templateArguments.length < template.templateParams.length) {
            const init = template.templateParams[templateArguments.length].init;
            if (init !== null) {
                templateArguments.push(init);
            } else {
                throw new SyntaxError(`template number mismatch of template ${template.shortName}`, this);
            }
        }
        return templateArguments;
    }

    public getLookupName(ctx: CompileContext): string {
        let fullName = "";
        if (this.isFullName) {
            fullName += "::";
        }
        for (let i = 0; i < this.name.length; i++) {
            if (i !== 0) {
                fullName += "::";
            }
            fullName += this.name[i].name;
            if (i !== this.name.length - 1 &&
                (this.name[i].type === IDType.T_FUNC_INS || this.name[i].type === IDType.T_CLASS_INS)) {
                const templateName = new Identifier(this.location, this.name.slice(0, i + 1), this.isFullName)
                    .getLookupName(ctx);
                const templateItem = ctx.scopeManager.lookup(templateName);
                if (!templateItem) {
                    throw new SyntaxError(`undefined template name ${fullName}`, this);
                }
                if (this.name[i].type === IDType.T_FUNC_INS) {
                    throw new SyntaxError(`illegal function template name ${fullName}`, this);
                } else {
                    if (!(templateItem instanceof ClassTemplate)) {
                        throw new SyntaxError(`${fullName} is not class template name`, this);
                    }
                    const templateArguments = this.fillInBlank(ctx, this.name[i].args, templateItem);
                    const realName = templateName + "<" + templateArguments.join(",") + ">";
                    const item = ctx.scopeManager.lookup(realName);
                    if (!item) {
                        instantiateClassTemplate(ctx, templateItem, templateArguments, this);
                    }
                    fullName = realName;
                }
            }
        }
        if (this.getLastID().type === IDType.OPE_TYPE) {
            return this.getOverloadName(ctx, fullName);
        }
        return fullName;
    }

    public tryLookupImplicitThis(ctx: CompileContext): MemberExpression {
        const thisPtr = ctx.scopeManager.lookup("this");
        if (thisPtr !== null) {
            try {
                return new MemberExpression(this.location, Identifier.fromString(this.location, "this"),
                    true, this);
            } catch (e) {
                throw new SyntaxError(`Unresolve Name ${this.getLookupName(ctx)}`, this);
            }
        } else {
            throw new SyntaxError(`Unresolve Name ${this.getLookupName(ctx)}`, this);
        }
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const lookupName = this.getLookupName(ctx);
        let rawItem = ctx.scopeManager.lookup(lookupName);
        rawItem = this.filterMemberFunction(rawItem);
        if (!rawItem) {
            return this.tryLookupImplicitThis(ctx).codegen(ctx);
        } else if (rawItem instanceof Variable) {
            return {
                type: rawItem.type,
                expr: WAddressHolder.fromVariable(ctx, rawItem, this),
            };
        } else if (rawItem instanceof FunctionLookUpResult) {
            return {
                type: new UnresolvedFunctionOverloadType(rawItem),
                expr: WEmptyExpression.instance,
            };
        } else {
            throw new SyntaxError(`name ${lookupName} is a ${rawItem.constructor.name}`, this);
        }
    }

    public filterMemberFunction(rawItem: LookUpResult): LookUpResult {
        if (rawItem && rawItem instanceof FunctionLookUpResult) {
            rawItem.functions = rawItem.functions.filter(
                (x) =>
                    !(x instanceof FunctionEntity && x.type.cppFunctionType === CppFunctionType.MemberFunction));
            if (rawItem.functions.length === 0) {
                rawItem = null;
            }
        }
        return rawItem;
    }

    public deduceType(ctx: CompileContext): Type {
        const lookupName = this.getLookupName(ctx);
        let rawItem = ctx.scopeManager.lookup(lookupName);
        // fix: member fucntion could not be search here
        rawItem = this.filterMemberFunction(rawItem);
        if (!rawItem) {
            return this.tryLookupImplicitThis(ctx).deduceType(ctx);
        }
        if (this.getLastID().type === IDType.ID) {
            if (rawItem instanceof Variable) {
                return rawItem.type;
            } else if (rawItem instanceof FunctionLookUpResult) {
                return new UnresolvedFunctionOverloadType(rawItem);
            } else {
                throw new SyntaxError(`name ${lookupName} should be variable`
                    + ` but it is a ${rawItem.constructor.name}`, this);
            }
        } else if (this.getLastID().type === IDType.TYPE) {
            if (rawItem instanceof Type) {
                return rawItem;
            } else {
                throw new SyntaxError(`name ${lookupName} should be type`
                    + ` but it is a ${rawItem.constructor.name}`, this);
            }
        } else if (this.getLastID().type === IDType.T_FUNC) {
            throw new SyntaxError(`name ${lookupName} is a function template`, this);
        } else if (this.getLastID().type === IDType.T_FUNC_INS) {
            if (rawItem instanceof FunctionLookUpResult) {
                rawItem.templateArguments = this.getLastID().args.map((arg) => arg.evaluate(ctx));
                return new UnresolvedFunctionOverloadType(rawItem);
            } else {
                throw new SyntaxError(`name ${lookupName} should be template function`
                    + ` but it is a ${rawItem.constructor.name}`, this);
            }
        } else if (this.getLastID().type === IDType.T_CLASS) {
            throw new SyntaxError(`name ${lookupName} is a class template`, this);
        } else if (this.getLastID().type === IDType.T_CLASS_INS) {
            if (rawItem instanceof ClassTemplate) {
                const templateArguments = this.fillInBlank(ctx, this.getLastID().args, rawItem);
                const realName = lookupName + "<" + templateArguments.join(",") + ">";
                const item = ctx.scopeManager.lookup(realName);
                if (!item) {
                    return instantiateClassTemplate(ctx, rawItem, templateArguments, this);
                }
                if (!(item instanceof ClassType)) {
                    throw new SyntaxError(`name ${lookupName} should be class template`
                        + ` but it is a ${rawItem.constructor.name}`, this);
                }
                return item;
            } else {
                throw new SyntaxError(`name ${lookupName} should be template function`
                    + ` but it is a ${rawItem.constructor.name}`, this);
            }
        }
        throw new InternalError(`unreachable`);
    }
}
