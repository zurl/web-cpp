import {SourceLocation} from "../../common/node";
import {Emitter} from "../emitter/emitter";
import {WNode} from "../node";
import {WStatement} from "../statement/wstatement";
import {Control, getNativeType, WType} from "../tool/constant";
import {WFunctionType} from "./wfunction_type";

export class WFunction extends WNode {
    public name: string;
    public type: WFunctionType;
    public local: WType[];
    public body: WStatement[];
    public signatureId: number;
    public displayName: string;

    // fill in linking
    public dataStart: number;
    public bssStart: number;
    public fileName: string;

    constructor(name: string, displayName: string, returnType: WType[], parameters: WType[],
                local: WType[], body: WStatement[], location: SourceLocation) {
        super(location);
        this.name = name;
        this.displayName = displayName;
        this.type = new WFunctionType(returnType, parameters, location);
        this.local = local;
        this.body = body;
        this.signatureId = 0;

        // fill in linking
        this.dataStart = 0;
        this.bssStart = 0;
        this.fileName = "";
    }

    public emit(e: Emitter): void {
        const slot = e.createLengthSlot();
        e.emit(WType.u32, this.local.length);
        this.local.map((x) => {
            e.emit(WType.u32, 1);
            e.writeByte(getNativeType(x));
        });
        e.enterFunction(this);
        this.body.map((stmt) => stmt.emit(e));
        e.submitFunction();
        e.emitIns(Control.end, WType.none, 0, this.location);
        e.fillLengthSlot(slot);
    }

    public optimize(e: Emitter): void {
        this.body.map((x) => x.optimize(e));
    }

}
