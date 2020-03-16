/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {Node, SourceLocation} from "../common/node";
import {Emitter} from "./emitter/emitter";

export abstract class WNode extends Node {

    protected constructor(location: SourceLocation) {
        super(location);
    }

    public abstract emit(e: Emitter): void;

    public optimize(e: Emitter): void {
        return;
    }
}
