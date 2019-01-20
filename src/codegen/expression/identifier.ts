import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {Variable} from "../../common/symbol";
import {Type} from "../../type";
import {UnresolvedFunctionOverloadType} from "../../type/function_type";
import {ClassTemplate} from "../../type/template_type";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {FunctionLookUpResult, LookUpResult} from "../scope";
import {TemplateArgument} from "../template/template_argument";
import {Expression, ExpressionResult} from "./expression";
import {instantiateClassTemplate} from "../template/class_template_instantiation";
export enum IDType {
    ID,
    TYPE,
    T_FUNC,
    T_FUNC_INS,
    T_CLASS,
    T_CLASS_INS,
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

    public static fromString(location: SourceLocation, str: string) {
        return new Identifier(location, [new SingleIdentifier(
            location, str, IDType.ID, [],
        )], false);
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
        if (!(this.name.length === 1 && this.name[0].type === IDType.TYPE)) {
            throw new SyntaxError(`${this.getLookupName(ctx)} is not a valid identifier`, this);
        }
        return this.getShortName(ctx);
    }

    public getShortName(ctx: CompileContext): string {
        if (this.getLastID().type === IDType.T_CLASS || this.getLastID().type === IDType.T_FUNC) {
            return this.getLastID().name +  "<" + this.getLastID().args
                .map((x) => x.evaluate(ctx))
                .join(",") + ">";
        } else {
            return this.getLastID().name;
        }
    }

    public getFullName(ctx: CompileContext): string {
        if (this.isFullName) {
            return this.getLookupName(ctx);
        } else {
            return ctx.scopeManager.getFullName(this.getLookupName(ctx));
        }
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
            if (this.name[i].type === IDType.T_CLASS || this.name[i].type === IDType.T_FUNC) {
                fullName += "<" + this.name[i].args
                    .map((x) => x.evaluate(ctx))
                    .join(",") + ">";
            }
        }
        return fullName;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        const lookupName = this.getLookupName(ctx);
        assertIDType(IDType.ID, this.getType(), this.getLastID().name, this);
        const rawItem = ctx.scopeManager.lookup(lookupName);
        const item = assertLookUpResult<Variable>(Variable.name, rawItem, lookupName, this);
        return {
            type: item.type,
            expr: new WAddressHolder(item.location, item.addressType, this.location),
            isLeft: true,
        };
    }

    public deduceType(ctx: CompileContext): Type {
        const lookupName = this.getLookupName(ctx);
        const rawItem = ctx.scopeManager.lookup(lookupName);
        if (!rawItem) {
            throw new SyntaxError(`unresolved name ${lookupName}`, this);
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
                const templateArguments = this.getLastID().args.map((x) => x.evaluate(ctx));
                while (templateArguments.length < rawItem.templateParams.length) {
                    const init = rawItem.templateParams[templateArguments.length].init;
                    if (init !== null) {
                        templateArguments.push(init);
                    } else {
                        throw new SyntaxError(`template number mismatch of template ${rawItem.shortName}`, this);
                    }
                }
                const signature = templateArguments.map((x) => x.toString()).join(",");
                const classType = rawItem.instanceMap.get(signature);
                if (classType) {
                    return classType;
                }
                return instantiateClassTemplate(ctx, rawItem, templateArguments, this);
            } else {
                throw new SyntaxError(`name ${lookupName} should be template function`
                    + ` but it is a ${rawItem.constructor.name}`, this);
            }
        }
        throw new InternalError(`unreachable`);
    }
}

function getTextFromIDType(idtype: IDType): string {
    switch (idtype) {
        case IDType.ID: return "variable";
        case IDType.TYPE: return "type";
        case IDType.T_FUNC: return "function template";
        case IDType.T_FUNC_INS: return "function instance";
        case IDType.T_CLASS: return "class template";
        case IDType.T_CLASS_INS: return "class instance";
    }
    return "";
}

function assertIDType<T extends LookUpResult>(shouldBe: IDType, fact: IDType,
                                              name: string, node: Node) {
    if (shouldBe !== fact) {
        throw new SyntaxError(`${name} expect to be a ${getTextFromIDType(shouldBe)},`
            + `but it is a ${getTextFromIDType(fact)}`, node);

    }
}

function assertLookUpResult<T extends LookUpResult>(shouldBe: string, fact: LookUpResult,
                                                    name: string, node: Node): T {
    if (!fact) {
        throw new SyntaxError(`unresolved name ${name}`, node);
    }
    if (fact.constructor.name !== shouldBe) {
        throw new SyntaxError(`name ${name} should be ${shouldBe} but it is a ${fact.constructor.name}`, node);
    }
    return fact as T;
}
