/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 06/07/2018
 */
import {InternalError} from "../common/error";
import {fromBytesToString} from "../common/utils";

export abstract class VMFile {

    public abstract read(buffer: ArrayBuffer, size: number): number;

    public abstract write(buffer: ArrayBuffer): number;

    public abstract flush(): number;

}

export class NoInputFile extends VMFile {
    public read(buffer: ArrayBuffer, size: number): number {
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

    public read(buffer: ArrayBuffer, size: number): number {
        throw new InternalError(`CommandOutputFile is not support read`);
    }

    public write(buffer: ArrayBuffer): number {
        this.buffer += fromBytesToString(new DataView(buffer), 0);
        if (this.buffer.includes("\n")) {
            const lines = this.buffer.split("\n");
            this.buffer = lines[lines.length - 1];
            lines.slice(0, lines.length - 10).map((line) => console.log(line));
        }
        return buffer.byteLength;
    }

    public flush(): number {
        const len = this.buffer.length;
        console.log(this.buffer);
        this.buffer = "";
        return len;
    }
}
