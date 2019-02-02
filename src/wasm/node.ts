/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/node";
import {Emitter} from "./emitter/emitter";

export abstract class WNode {
    public location: SourceLocation;

    protected constructor(location: SourceLocation) {
        this.location = location;
    }

    public abstract emit(e: Emitter): void;

    public optimize(e: Emitter): void {
        return;
    }
}
