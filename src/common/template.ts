import {ClassSpecifier} from "../codegen/class/class_specifier";
import {FunctionConfig} from "../codegen/function/function";
import {FunctionDefinition} from "../codegen/function/function_definition";
import {ScopeContext} from "../codegen/scope";
import {AccessControl, Type} from "../type";
import {ClassType} from "../type/class_type";
import {TemplateType} from "../type/template_type";
import {FunctionEntity, OverloadSymbol, Symbol} from "./symbol";

export interface TemplateParameter {
    name: string;
    type: Type;
    init: Type | string | null;
}

export class FunctionTemplate extends OverloadSymbol {
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
                scopeContext: ScopeContext, accessControl: AccessControl) {
        super(accessControl);
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

    public getFullName(): string {
        return this.fullName;
    }

    public getIndexName(): string {
        return this.shortName.split("@")[0];
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
                templateParams: TemplateParameter[], classBody: ClassSpecifier,
                scopeContext: ScopeContext, accessControl: AccessControl) {
        super(accessControl);
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
