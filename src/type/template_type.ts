import {Scope} from "../codegen/scope";
import {FunctionDefinition} from "../common/ast";
import {InternalError} from "../common/error";
import {FunctionEntity} from "../common/symbol";
import {WType} from "../wasm";
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
    public contextScope: Scope;

    constructor(name: string, fullName: string, fileName: string,
                functionType: FunctionType, templateParams: TemplateParameter[],
                functionBody: FunctionDefinition, contextScope: Scope) {
        super(name, fullName, fileName, functionType, false, true, AccessControl.Public);
        this.templateParams = templateParams;
        this.functionBody = functionBody;
        this.instanceMap = new Map<string, FunctionEntity>();
        this.contextScope = contextScope;
    }
}
