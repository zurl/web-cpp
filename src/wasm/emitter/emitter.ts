import {SourceLocation} from "../../common/node";
import {SourceMap} from "../../common/object";
import {WFunction} from "../section/wfunction";
import {WType} from "../tool/constant";
import {EmitterContext} from "./emitter_context";

export abstract class Emitter {

    public ctx: EmitterContext;

    constructor(externMap: Map<string, number>, sourceMap: Map<string, SourceMap>) {
        this.ctx = new EmitterContext(externMap, sourceMap);
    }

    public abstract emit(type: WType, value: number | string): void;

    public abstract emitIns(control: number, valueType: WType, value: number | string,
                            location: SourceLocation, align?: boolean): void;

    public abstract createLengthSlot(): [number, number];

    public abstract fillLengthSlot(slot: [number, number]): void;

    public abstract enterFunction(func: WFunction): void;

    public abstract submitFunction(): void;

    public abstract writeByte(byte: number): void;

    public abstract writeBytes(bytes: number[]): void;

}
