/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 06/07/2018
 */
import {InternalError} from "../common/error";
import {fromBytesToString} from "../common/utils";

export abstract class VMFile {

    public abstract read(buffer: ArrayBuffer, offset: number, size: number): number;

    public abstract write(buffer: ArrayBuffer): number;

    public abstract flush(): number;

}

export class NoInputFile extends VMFile {
    public read(buffer: ArrayBuffer, offset: number, size: number): number {
        return 0;
    }

    public write(buffer: ArrayBuffer): number {
        throw new InternalError(`NoInputFile is not support write`);
    }

    public flush(): number {
        return 0;
    }
}

export class CommandOutputFile extends VMFile {
    public buffer: string;

    constructor() {
        super();
        this.buffer = "";
    }

    public read(buffer: ArrayBuffer, offset: number, size: number): number {
        throw new InternalError(`CommandOutputFile is not support read`);
    }

    public write(buffer: ArrayBuffer): number {
        this.buffer += fromBytesToString(new DataView(buffer), 0, buffer.byteLength);
        if (this.buffer.includes("\n")) {
            const lines = this.buffer.split("\n");
            this.buffer = lines[lines.length - 1];
            lines.slice(0, lines.length - 1).map((line) => console.log(line));
        }
        return buffer.byteLength;
    }

    public flush(): number {
        const len = this.buffer.length;
        if ( this.buffer.length === 0 ) {
            return 0;
        }
        console.log(this.buffer);
        this.buffer = "";
        return len;
    }
}

export class StringInputFile extends VMFile {
    public str: string;
    public offset: number;

    constructor(str: string) {
        super();
        this.str = str;
        this.offset = 0;
    }

    public flush(): number {
        return 0;
    }

    public read(buffer: ArrayBuffer, offset: number, size: number): number {
        let bytes = 0;
        for (let i = 0; i < size; i++) {
            if (this.offset >= this.str.length) { return bytes; }
            new DataView(buffer).setUint8(offset + i, this.str.charCodeAt(this.offset));
            this.offset ++;
            bytes++;
        }
        return bytes;
    }

    public write(buffer: ArrayBuffer): number {
        throw new InternalError(`NoInputFile is not support write`);
    }
}

export class StringOutputFile extends VMFile {
    public output: string[];

    constructor(output: string[]) {
        super();
        this.output = output;
    }

    public read(buffer: ArrayBuffer, offset: number, size: number): number {
        throw new InternalError(`CommandOutputFile is not support read`);
    }

    public write(buffer: ArrayBuffer): number {
        this.output[0] += fromBytesToString(new DataView(buffer), 0, buffer.byteLength);
        return buffer.byteLength;
    }

    public flush(): number {
        return 0;
    }
}

export class CallbackOutputFile extends VMFile {
    public callback: (content: string) => void;

    constructor(callback: (content: string) => void) {
        super();
        this.callback = callback;
    }

    public read(buffer: ArrayBuffer, offset: number, size: number): number {
        throw new InternalError(`CommandOutputFile is not support read`);
    }

    public write(buffer: ArrayBuffer): number {
        this.callback(fromBytesToString(new DataView(buffer), 0, buffer.byteLength));
        return buffer.byteLength;
    }

    public flush(): number {
        return 0;
    }
}
