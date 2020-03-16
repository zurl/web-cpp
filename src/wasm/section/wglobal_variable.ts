import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {JSONEmitter} from "../emitter/json_emitter";
import {WConst} from "../expression/wconst";
import {WExpression} from "../expression/wexpression";
import {WNode} from "../node";
import {Control, getNativeType, WType} from "../tool/constant";

export class WGlobalVariable extends WNode {
    public name: string;
    public type: WType;
    public init: WExpression;

    constructor(name: string, type: WType, init: WExpression, location: SourceLocation) {
        super(location);
        this.name = name;
        this.type = type;
        this.init = init;
    }

    public emit(e: Emitter): void {
        e.ctx.submitGlobal(this.name, this.type);
        e.writeByte(getNativeType(this.type));
        e.writeByte(0x01); // mutable
        this.init.emit(e);
        e.writeByte(Control.end);
        if ( e instanceof JSONEmitter) {
            if (this.init instanceof WConst) {
                e.getJSON().globals.push({
                    name: this.name,
                    type: getNativeType(this.type),
                    init: this.init.constant,
                });
            } else {
                throw new EmitError(`unknown error`);
            }
        }
    }
}
