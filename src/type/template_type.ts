import {Scope} from "../codegen/scope";
import {ClassSpecifier, FunctionDefinition} from "../common/ast";
import {InternalError} from "../common/error";
import {FunctionEntity, Symbol} from "../common/symbol";
import {WType} from "../wasm";
import {ClassType} from "./class_type";
import {FunctionType} from "./function_type";
import {AccessControl, Type} from "./index";

export class TemplateType extends Type {
    public get length(): number {
        throw new InternalError("unintent behavior");
    }

    public static instance: TemplateType;

    public toMangledName(): string {
        throw new InternalError("unintent behavior");
    }

    public toWType(): WType {
        throw new InternalError("unintent behavior");
    }

    public toString(): string {
        throw new InternalError("unintent behavior");
    }
}
TemplateType.instance = new TemplateType();

export class TemplateParameterPlaceHolderType extends Type {
    public index: number;

    constructor(index: number) {
        super();
        this.index = index;
    }

    public get length(): number {
        return 0;
    }

    public toMangledName(): string {
        return "^" + this.index;
    }

    public toWType(): WType {
        throw new InternalError("unintent behavior");
    }

    public toString(): string {
        return "^" + this.index;
    }
}

export interface TemplateParameter {
    name: string;
    type: Type;
    init: Type | string | null;
}

export type EvaluatedTemplateArgument = string | Type;

export class FunctionTemplate extends FunctionEntity {
    public templateParams: TemplateParameter[];
    public functionBody: FunctionDefinition;
    public instanceMap: Map<string, FunctionEntity>;
    public specializationMap: Map<string, FunctionDefinition>;
    public contextScope: Scope;
    public contextActiveScopes: Set<Scope>;

    constructor(name: string, fullName: string, fileName: string,
                functionType: FunctionType, templateParams: TemplateParameter[],
                functionBody: FunctionDefinition, contextScope: Scope, contextActiveScopes: Set<Scope>) {
        super(name, fullName, fileName, functionType, false, true, AccessControl.Public);
        this.templateParams = templateParams;
        this.functionBody = functionBody;
        this.instanceMap = new Map<string, FunctionEntity>();
        this.specializationMap = new Map<string, FunctionDefinition>();
        this.contextScope = contextScope;
        this.contextActiveScopes = new Set<Scope>(Array.from(contextActiveScopes));
    }
}

export class ClassTemplate extends Symbol {
    public name: string;
    public fullName: string;
    public fileName: string;
    public templateParams: TemplateParameter[];
    public classBody: ClassSpecifier;
    public instanceMap: Map<string, ClassType>;
    public specializationMap: Map<string, ClassSpecifier>;
    public contextScope: Scope;
    public contextActiveScopes: Set<Scope>;

    constructor(name: string, fullName: string, fileName: string,
                templateParams: TemplateParameter[],
                classBody: ClassSpecifier, contextScope: Scope, contextActiveScopes: Set<Scope>) {
        super();
        this.templateParams = templateParams;
        this.classBody = classBody;
        this.name = name;
        this.fileName = fileName;
        this.fullName = fullName;
        this.instanceMap = new Map<string, ClassType>();
        this.specializationMap = new Map<string, ClassSpecifier>();
        this.contextScope = contextScope;
        this.contextActiveScopes = new Set<Scope>(Array.from(contextActiveScopes));
    }

    public getType(): Type {
        return TemplateType.instance;
    }

    public isDefine(): boolean {
        return true;
    }
}
