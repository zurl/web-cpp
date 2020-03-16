import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {getNativeType, WType} from "../tool/constant";

export class WFunctionType extends WNode {

    public static n2s(x: number): string {
        if (x === WType.i32) { return "i"; }
        if (x === WType.i64) { return "l"; }
        if (x === WType.f32) { return "f"; }
        if (x === WType.f64) { return "d"; }
        return "v";
    }

    public static s2n(x: string): WType {
        if (x === "i") { return WType.i32; }
        if (x === "l") { return WType.i64; }
        if (x === "f") { return WType.f32; }
        if (x === "d") { return WType.f64; }
        return WType.none;
    }

    public static fromEncoding(encoding: string, location: SourceLocation) {
        const result = new WFunctionType([], [], location);
        if (encoding.charAt(0) !== "v") {
            result.returnTypes.push(WFunctionType.s2n(encoding.charAt(0)));
        }
        for (let i = 1; i < encoding.length; i++) {
            result.parameters.push(WFunctionType.s2n(encoding.charAt(i)));
        }
        return result;
    }

    public returnTypes: WType[];
    public parameters: WType[];

    constructor(returnTypes: WType[], parameters: WType[], location: SourceLocation) {
        super(location);
        this.returnTypes = returnTypes;
        this.parameters = parameters;
    }

    public emit(e: Emitter): void {
        e.writeByte(0x60);
        e.emit(WType.u32, this.parameters.length);
        this.parameters.map((type) => e.emit(WType.u32, getNativeType(type)));
        e.emit(WType.u32, this.returnTypes.length);
        this.returnTypes.map((type) => e.emit(WType.u32, getNativeType(type)));
    }

    public toString(): string {
        return this.parameters.join(",") + "#" + this.returnTypes.join(",");
    }

    public toEncoding(): string {
        let result = "";
        if (this.returnTypes.length === 0) {
            result += "v";
        } else {
            result += WFunctionType.n2s(getNativeType(this.returnTypes[0]));
        }
        this.parameters.map((ty) => result += WFunctionType.n2s(getNativeType(ty)));
        return result;
    }

}
