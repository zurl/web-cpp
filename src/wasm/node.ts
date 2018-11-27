/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {WType} from "./constant";
import {Emitter, JSONEmitter} from "./emitter";


export abstract class WNode {
    public location?: SourceLocation;

    protected constructor(location?: SourceLocation) {
        this.location = location;
    }

    public abstract emit(e: Emitter): void;

    public abstract length(e: Emitter): number;

    public abstract emitJSON(e: JSONEmitter): void;

    public abstract dump(e: Emitter): void;

    public optimize(e: Emitter): void {
        return;
    }
}

export abstract class WExpression extends WNode {

    public abstract deduceType(e: Emitter): WType;

    public abstract fold(): WExpression;

    public abstract isPure(): boolean;

}

export abstract class WStatement extends WNode {

}

export abstract class WSection extends WNode {

}

export function getArrayLength<T>(array: T[], mapper: (t: T) => number) {
    return array.map(mapper).reduce((x, y) => x + y, 0);
}
