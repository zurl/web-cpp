import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {WType} from "../tool/constant";

export class WImportItem extends WNode {
    public module: string;
    public name: string;

    constructor(module: string, name: string, location: SourceLocation) {
        super(location);
        this.module = module;
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.emit(WType.str, this.module);
        e.emit(WType.str, this.name);
    }

}
