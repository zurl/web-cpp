/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/07/2018
 */
import {EmitError, InternalError} from "../common/error";
import {SourceLocation} from "../common/node";
import {AddressType} from "../common/symbol";
import {Type} from "../type";
import {ClassType} from "../type/class_type";
import {ArrayType} from "../type/compound_type";
import {
    Emitter,
    getNativeType,
    I32Binary,
    WBinaryOperation,
    WConst, WExpression, WGetAddress, WGetGlobal, WGetLocal,
    WLoad,
    WMemoryLocation,
    WSetGlobal, WSetLocal, WStatement,
    WStore,
    WType,
} from "../wasm";
import {CompileContext} from "./context";

export class WAddressHolder extends WExpression {
    public place: number | string | WExpression;
    public type: AddressType;
    public offset: number;

    constructor(place: number | string | WExpression, type: AddressType, location: SourceLocation) {
        super(location);
        this.place = place;
        this.type = type;
        this.offset = 0;
    }

    public createStore(ctx: CompileContext,
                       type: Type,
                       value: WExpression,
                       requireAlign: boolean = false): WStatement {
        let result: WStatement | null = null;
        if ( type instanceof ArrayType || type instanceof ClassType) {
            throw new InternalError(`could not assign a array or class`);
        } else {
            const wtype = requireAlign ? getNativeType(type.toWType()) : type.toWType();
            switch (this.type) {
                case AddressType.LOCAL:
                result = new WSetLocal(
                    wtype,
                    this.place as number,
                    value,
                    this.location,
                );
                if ( this.offset !== 0) {
                    throw new InternalError(`illegal offset`);
                }
                break;
                case AddressType.MEMORY_DATA:
                    result = new WStore(
                        wtype,
                        new WConst(WType.i32, "0", this.location),
                        value,
                        WMemoryLocation.DATA,
                        this.location,
                    );
                    (result as WStore).offset = this.place as number + this.offset;
                    break;
                case AddressType.MEMORY_BSS:
                    result = new WStore(
                        wtype,
                        new WConst(WType.i32, "0", this.location),
                        value,
                        WMemoryLocation.BSS,
                        this.location,
                    );
                    (result as WStore).offset = this.place as number + this.offset;
                    break;
                case AddressType.MEMORY_EXTERN:
                    result = new WStore(
                        wtype,
                        new WConst(WType.i32, "0", this.location),
                        value,
                        WMemoryLocation.EXTERN,
                        this.location,
                    );
                    (result as WStore).offset = this.offset;
                    (result as WStore).offsetName = this.place as string;
                    break;
                case AddressType.CONSTANT:
                    throw new InternalError(`store a constant()`);
                case AddressType.STACK:
                    if (ctx.currentFuncContext.currentFunction === null) {
                        throw new InternalError(`not in function`);
                    }
                    result = new WStore(
                        wtype,
                        new WGetLocal(WType.i32, ctx.currentFuncContext.currentFunction.$sp, this.location),
                        value,
                        WMemoryLocation.RAW,
                        this.location,
                    );
                    (result as WStore).offset = this.place as number + this.offset;
                    break;
                case AddressType.GLOBAL:
                    result = new WSetGlobal(
                        wtype,
                        this.place as string,
                        value,
                        this.location,
                    );
                    if ( this.offset !== 0) {
                        throw new InternalError(`illegal offset`);
                    }
                    break;
                case AddressType.GLOBAL_SP:
                    result = new WStore(
                        // require align
                        wtype,
                        new WGetGlobal(WType.u32, "$sp", this.location),
                        value,
                        WMemoryLocation.RAW,
                        this.location,
                    );
                    (result as WStore).offset = this.place as number + this.offset;
                    break;
                case AddressType.RVALUE:
                    result = new WStore(
                        wtype,
                        new WBinaryOperation(I32Binary.add,
                            this.place as WExpression,
                            new WConst(WType.i32, this.offset.toString(), this.location),
                            this.location),
                        value,
                        WMemoryLocation.RAW,
                        this.location,
                    );
                    break;
            }
        }
        if (result === null) {
            throw new InternalError(`createStore()`);
        }
        return result;
    }

    public createLoad(ctx: CompileContext, type: Type): WExpression {
        let result: WExpression | null = null;
        if ( type instanceof ArrayType || type instanceof ClassType ) {
            throw new InternalError(`unsupport`);
        } else {
            switch (this.type) {
                case AddressType.LOCAL:
                    result = new WGetLocal(
                        type.toWType(),
                        this.place as number,
                        this.location,
                    );
                    if ( this.offset !== 0) {
                        throw new InternalError(`illegal offset`);
                    }
                    break;
                case AddressType.MEMORY_DATA:
                    result = new WLoad(
                        type.toWType(),
                        new WConst(WType.i32, "0", this.location),
                        WMemoryLocation.DATA,
                        this.location,
                    );
                    (result as WLoad).offset = this.place as number + this.offset;
                    break;
                case AddressType.MEMORY_BSS:
                    result = new WLoad(
                        type.toWType(),
                        new WConst(WType.i32, "0", this.location),
                        WMemoryLocation.BSS,
                        this.location,
                    );
                    (result as WLoad).offset = this.place as number + this.offset;
                    break;
                case AddressType.MEMORY_EXTERN:
                    result = new WLoad(
                        type.toWType(),
                        new WConst(WType.i32, "0", this.location),
                        WMemoryLocation.EXTERN,
                        this.location,
                    );
                    (result as WLoad).offsetName = this.place as string;
                    (result as WLoad).offset = this.offset;
                    break;
                case AddressType.CONSTANT:
                    result = new WConst(WType.i32, this.place.toString(), this.location);
                    if ( this.offset !== 0) {
                        throw new InternalError(`illegal offset`);
                    }
                    break;
                case AddressType.STACK:
                    if (ctx.currentFuncContext.currentFunction === null) {
                        throw new InternalError(`not in function`);
                    }
                    result = new WLoad(
                        type.toWType(),
                        new WGetLocal(WType.i32, ctx.currentFuncContext.currentFunction.$sp, this.location),
                        WMemoryLocation.RAW,
                        this.location,
                    );
                    (result as WLoad).offset = this.place as number + this.offset;
                    break;
                case AddressType.GLOBAL:
                    result = new WGetGlobal(
                        type.toWType(),
                        this.place as string,
                        this.location,
                    );
                    if ( this.offset !== 0) {
                        throw new InternalError(`illegal offset`);
                    }
                    break;
                case AddressType.GLOBAL_SP:
                    result = new WLoad(
                        // require align
                        type.toWType(),
                        new WGetGlobal(WType.u32, "$sp", this.location),
                        WMemoryLocation.RAW,
                        this.location,
                    );
                    (result as WLoad).offset = this.place as number + this.offset;
                    break;
                case AddressType.RVALUE:
                    result = new WLoad(
                        type.toWType(),
                        new WBinaryOperation(I32Binary.add,
                            this.place as WExpression,
                            new WConst(WType.i32, this.offset.toString(), this.location),
                            this.location),
                        WMemoryLocation.RAW,
                        this.location,
                    );
                    break;
            }
        }
        if (result === null) {
            throw new InternalError(`createLoad()`);
        }
        return result;
    }

    public createLoadAddress(ctx: CompileContext): WExpression {
        let result: WExpression | null = null;
        switch (this.type) {
            case AddressType.LOCAL:
                throw new InternalError(`could not get address of local variable`);
            case AddressType.MEMORY_DATA:
                result = new WGetAddress(
                    WMemoryLocation.DATA,
                    this.location,
                );
                (result as WGetAddress).offset = this.place as number + this.offset;
                break;
            case AddressType.MEMORY_BSS:
                result = new WGetAddress(
                    WMemoryLocation.BSS,
                    this.location,
                );
                (result as WGetAddress).offset = this.place as number + this.offset;
                break;
            case AddressType.MEMORY_EXTERN:
                result = new WGetAddress(
                    WMemoryLocation.EXTERN,
                    this.location,
                );
                (result as WGetAddress).offset = this.offset;
                (result as WGetAddress).offsetName = this.place as string;
                break;
            case AddressType.CONSTANT:
                throw new InternalError(`store a constant()`);
            case AddressType.STACK:
                if ( ctx.currentFuncContext.currentFunction === null) {
                    throw new InternalError(`not in function`);
                }
                result = new WBinaryOperation(
                    I32Binary.add,
                    new WGetLocal(WType.i32, ctx.currentFuncContext.currentFunction.$sp, this.location),
                    new WConst(WType.i32, (this.place as number + this.offset).toString(), this.location),
                    this.location,
                );
                break;
            case AddressType.GLOBAL_SP:
                if ( ctx.currentFuncContext.currentFunction === null) {
                    throw new InternalError(`not in function`);
                }
                result = new WBinaryOperation(
                    I32Binary.add,
                    new WGetGlobal(WType.i32, "$sp", this.location),
                    new WConst(WType.i32, (this.place as number + this.offset).toString(), this.location),
                    this.location,
                );
                break;
            case AddressType.RVALUE:
                result = new WBinaryOperation(I32Binary.add,
                    this.place as WExpression,
                    new WConst(WType.i32, this.offset.toString(), this.location),
                    this.location);
                break;
            case AddressType.GLOBAL:
                throw new InternalError(`could not get address of global variable`);
        }
        if (result === null) {
            throw new InternalError(`createStore()`);
        }
        return result;
    }

    public makeOffset(offset: number): WAddressHolder {
        if (this.type === AddressType.LOCAL) {
            throw new InternalError(`could not get address of local variable`);
        }
        this.offset += offset;
        return this;
    }

    public deduceType(e: Emitter): WType {
        throw new EmitError(`WAddressHolder()`);
    }

    public emit(e: Emitter): void {
        throw new EmitError(`WAddressHolder()`);
    }

    public isPure(): boolean {
        return true;
    }

}
