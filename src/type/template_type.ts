import {InternalError} from "../common/error";
import {WType} from "../wasm";
import {Type} from "./index";

export class TemplateType extends Type {
    public get length(): number {
        throw new InternalError("undefined behavior");
    }

    public static instance: TemplateType;

    public toMangledName(): string {
        throw new InternalError("undefined behavior");
    }

    public toWType(): WType {
        throw new InternalError("undefined behavior");
    }

    public toString(): string {
        throw new InternalError("undefined behavior");
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
        throw new InternalError("undefined behavior");
    }

    public toMangledName(): string {
        return "^" + this.index;
    }

    public toWType(): WType {
        throw new InternalError("undefined behavior");
    }

    public toString(): string {
        return "^" + this.index;
    }
}
