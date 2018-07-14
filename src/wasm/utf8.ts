/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */

import { TextDecoder, TextEncoder} from "text-encoding";
import {getLeb128UintLength, readLeb128Uint, writeLeb128Uint} from "./leb128";

export interface ByteStream {
    view: DataView;
    now: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export function readUtf8Str(stream: ByteStream): string{
    const length = readLeb128Uint(stream).toNumber();
    return decoder.decode(stream.view.buffer.slice(0, length));
}

export function writeUtf8String(stream: ByteStream, input: string){
    const array = encoder.encode(input);
    writeLeb128Uint(stream, array.byteLength);
    new Uint8Array(stream.view.buffer).set(array, stream.now);
    stream.now += array.byteLength;
}

export function getUtf8StringLength(input: string){
    const blen = encoder.encode(input).byteLength;
    return getLeb128UintLength(blen) + blen;
}