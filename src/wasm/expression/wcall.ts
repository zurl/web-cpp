import {Control, Emitter, getNativeType, WExpression, WFakeExpression, WStatement, WType} from "..";
import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";

export class WCall extends WExpression {
    public target: string;
    public argument: WExpression[];
    public afterStatements: WStatement[];

    constructor(target: string, argument: WExpression[], afterStatements: WStatement[], location: SourceLocation) {
        super(location);
        this.target = target;
        this.argument = argument;
        this.afterStatements = afterStatements;
    }

    public emit(e: Emitter): void {
        this.argument.map((x) => x.emit(e));
        e.emitIns(Control.call, WType.u32, e.ctx.getFuncInfo(this.target).id, this.location);
        this.afterStatements.map((x) => x.emit(e));
    }

    public deduceType(e: Emitter): WType {
        const funcType = e.ctx.getFuncInfo(this.target).type;
        const arguTypes = this.argument
            .filter((x) => ! (x instanceof WFakeExpression))
            .map((x) => x.deduceType(e));
        if (funcType.parameters.map((x) => getNativeType(x)).join(",")
            !== arguTypes.map((x) => getNativeType(x)).join(",")) {
            throw new EmitError(`type mismatch at call`);
        }
        if (funcType.returnTypes.length === 0) {
            return WType.none;
        } else {
            return funcType.returnTypes[0];
        }
    }

    public fold(): WExpression {
        this.argument = this.argument.map((x) => x.fold());
        return this;
    }

    public isPure(): boolean {
        return false;
    }

}
