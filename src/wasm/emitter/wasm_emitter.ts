import {InternalError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {SourceMap} from "../../common/object";
import {WFunction} from "../section/wfunction";
import {WType} from "../tool/constant";
import {getLeb128UintLength, writeLeb128Int, writeLeb128Uint} from "../tool/leb128";
import {writeUtf8String} from "../tool/utf8";
import {Emitter} from "./emitter";

function getAlign(value: string | number) {
    return 0;
}

export class WASMEmitter extends Emitter {
    public buffer: ArrayBuffer;
    public view: DataView;
    public now: number;
    public nowSize: number;
    public slots: Array<[number, number]>;

    public constructor(externMap: Map<string, number>, sourceMap: Map<string, SourceMap>) {
        super(externMap, sourceMap);
        this.buffer = new ArrayBuffer(20000);
        this.view = new DataView(this.buffer);
        this.now = 0;
        this.nowSize = 0;
        this.slots = [];
    }

    public createLengthSlot(): [number, number] {
        const slot = [this.nowSize, this.now] as [number, number];
        this.slots.push(slot);
        this.now += 4;
        return slot;
    }

    public fillLengthSlot(slot: [number, number]): void {
        const len = this.nowSize - slot[0];
        this.nowSize += getLeb128UintLength(len);
        this.view.setUint32(slot[1], len);
    }

    public writeByte(byte: number): void {
        this.view.setUint8(this.now++, byte);
        this.nowSize++;
    }

    public writeBytes(bytes: number[]): void {
        for (const byte of bytes) {
            this.view.setUint8(this.now++, byte);
            this.nowSize++;
        }
    }

    public emit(type: WType, value: number | string): void {
        switch (type) {
            case WType.none:
                break;
            case WType.u8:
                if (typeof(value) === "string") {
                    throw new InternalError("unexpected string");
                }
                this.view.setUint8(this.now, value);
                this.now += 1;
                this.nowSize += 1;
                break;
            case WType.u32:
            case WType.u64:
                writeLeb128Uint(this, value);
                break;
            case WType.i32:
            case WType.i64:
                writeLeb128Int(this, value);
                break;
            case WType.f32:
                if (typeof(value) === "string") {
                    throw new InternalError("unexpected string");
                }
                this.view.setFloat32(this.now, value, true);
                this.now += 4;
                this.nowSize += 4;
                break;
            case WType.f64:
                if (typeof(value) === "string") {
                    throw new InternalError("unexpected string");
                }
                this.view.setFloat64(this.now, value, true);
                this.now += 8;
                this.nowSize += 8;
                break;
            case WType.str:
                if (typeof(value) === "number") {
                    throw new InternalError("unexpected string");
                }
                writeUtf8String(this, value);
                break;
            default:
                throw new InternalError("unexpected wtype");
        }
    }

    public emitIns(control: number, valueType: WType, value: number | string,
                   location: SourceLocation, align?: boolean): void {
        this.writeByte(control);
        if (align) {
            this.emit(WType.u32, getAlign(value));
        }
        this.emit(valueType, value);
    }

    public enterFunction(func: WFunction): void {
        this.ctx.setCurrentFunc(func);
    }

    public submitFunction(): void {
        this.ctx.setCurrentFunc(null);
    }

    public toArrayBuffer(): ArrayBuffer {
        const result = new ArrayBuffer(this.nowSize);
        const resultArray = new Uint8Array(result);
        const resultView = new DataView(result);
        const bufferArray = new Uint8Array(this.buffer);
        const stream = {
            view: resultView,
            now: 0,
            nowSize: 0,
        };
        let last = 0;
        for (const slot of this.slots) {
            if (slot[1] !== last) {
                resultArray.set(bufferArray.slice(last, slot[1]), stream.now);
                stream.now += slot[1] - last;
            }
            const len = this.view.getUint32(slot[1]);
            writeLeb128Uint(stream, len);
            last = slot[1] + 4;
        }
        resultArray.set(bufferArray.slice(last, this.now), stream.now);
        stream.now += this.now - last;
        if (stream.now !== this.nowSize) {
            throw new InternalError(`something wrong`);
        }
        return result;
    }
}
