import {ClassSpecifier} from "../codegen/class/class_specifier";
import {FunctionDefinition} from "../codegen/function/function_definition";
import {Scope, ScopeContext} from "../codegen/scope";
import {InternalError} from "../common/error";
import {FunctionEntity, Symbol} from "../common/symbol";
import {WType} from "../wasm";
import {ClassType} from "./class_type";
import {FunctionType} from "./function_type";
import {AccessControl, Type} from "./index";
import {FunctionConfig} from "../codegen/function/function";

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

export class FunctionTemplate extends Symbol {
    public shortName: string;
    public fullName: string;
    public functionConfig: FunctionConfig;
    public templateParams: TemplateParameter[];
    public functionBody: FunctionDefinition;
    public instanceMap: Map<string, FunctionEntity>;
    public specializationMap: Map<string, FunctionDefinition>;
    public scopeContext: ScopeContext;

    constructor(shortName: string, fullName: string, functionConfig: FunctionConfig,
                templateParams: TemplateParameter[], functionBody: FunctionDefinition,
                scopeContext: ScopeContext) {
        super();
        this.shortName = shortName;
        this.fullName = fullName;
        this.functionConfig = functionConfig;
        this.templateParams = templateParams;
        this.functionBody = functionBody;
        this.instanceMap = new Map<string, FunctionEntity>();
        this.specializationMap = new Map<string, FunctionDefinition>();
        this.scopeContext = scopeContext;
    }

    public getType(): Type {
        return TemplateType.instance;
    }

    public isDefine(): boolean {
        return true;
    }
}

export class ClassTemplate extends Symbol {
    public shortName: string;
    public fullName: string;
    public fileName: string;
    public templateParams: TemplateParameter[];
    public classBody: ClassSpecifier;
    public instanceMap: Map<string, ClassType>;
    public specializationMap: Map<string, ClassSpecifier>;
    public scopeContext: ScopeContext;
    constructor(shortName: string, fullName: string, fileName: string,
                templateParams: TemplateParameter[],
                classBody: ClassSpecifier, scopeContext: ScopeContext) {
        super();
        this.templateParams = templateParams;
        this.classBody = classBody;
        this.shortName = name;
        this.fileName = fileName;
        this.fullName = fullName;
        this.instanceMap = new Map<string, ClassType>();
        this.specializationMap = new Map<string, ClassSpecifier>();
        this.scopeContext = scopeContext;
    }

    public getType(): Type {
        return TemplateType.instance;
    }

    public isDefine(): boolean {
        return true;
    }
}
