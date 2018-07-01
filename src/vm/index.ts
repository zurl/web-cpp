/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {OpCode} from "../common/instruction";

export class VirtualMachine{
    memory: DataView;
    pc: number;
    bp: number;
    sp: number;

    constructor(memory: DataView) {
        this.memory = memory;
        this.pc = 0;
        this.bp = memory.buffer.byteLength;
        this.sp = this.bp;
    }

    runOneStep(){

    }
}