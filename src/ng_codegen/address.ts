/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/07/2018
 */
import {SourceLocation} from "../common/ast";
import {EmitError, InternalError} from "../common/error";
import {AddressType} from "../common/type";
import {WType} from "../wasm";
import {Emitter} from "../wasm/emitter";
import {WGetLocal} from "../wasm/expression";
import {WExpression, WStatement} from "../wasm/node";
import {WSetLocal} from "../wasm/statement";

export class WAddressHolder extends WExpression {
    public place: number | string | WExpression;
    public type: AddressType;

    constructor(place: number | string | WExpression, type: AddressType, location: SourceLocation) {
        super(location);
        this.place = place;
        this.type = type;
    }

    public createStore(type: WType, value: WExpression): WStatement {
        if (this.type === AddressType.LOCAL) {
            return new WSetLocal(
                type,
                this.place as number,
                value,
                this.location,
            );
        }

    }

    public createLoad(type: WType): WExpression {
        if (this.type === AddressType.LOCAL) {
            return new WGetLocal(
                type,
                this.place as number,
                this.location,
            );
        }
    }

    public createLoadAddress(): WExpression {
        if (this.type === AddressType.LOCAL) {
            throw new InternalError(`could not get address of local variable`);
        }
    }

    public makeOffset(offset: number): WAddressHolder {
        if (this.type === AddressType.LOCAL) {
            throw new InternalError(`could not get address of local variable`);
        }

        return this;
    }

    public deduceType(e: Emitter): WType {
        throw new EmitError(`WAddressHolder()`);
    }

    public emit(e: Emitter): void {
        throw new EmitError(`WAddressHolder()`);
    }

    public fold(): WExpression {
        return this;
    }

    public length(e: Emitter): number {
        throw new EmitError(`WAddressHolder()`);
    }

}
