import {OpCode} from "../common/instruction";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */


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
        const op = this.memory.getUint8(this.pc);
        this.pc++;
        if( op == OpCode.LM8 ){
            this.sp--;
            this.memory.setUint32(this.sp, this.memory.getUint8(this.memory.getUint32(this.pc)));
            this.pc++;
        }
        else if( op == OpCode.LM16 ){
            this.sp-=2;
            this.memory.setUint32(this.sp, this.memory.getUint16(this.memory.getUint32(this.pc)));
            this.pc+=4;
        }
        else if( op == OpCode.LM32 ){
            this.sp-=4;
            this.memory.setUint32(this.sp, this.memory.getUint32(this.memory.getUint32(this.pc)));
            this.pc+=4;
        }
        else if( op == OpCode.LM64 ){
            this.sp-=8;
            this.memory.setUint32(this.sp, this.memory.getUint32(this.memory.getUint32(this.pc)));
            this.memory.setUint32(this.sp + 4, this.memory.getUint32(this.memory.getUint32(this.pc) + 4));
            this.pc+=4;
        }
        else if( op == OpCode.SM8 ){
            this.memory.setUint8(this.memory.getUint32(this.pc), this.memory.getUint32(this.sp));
            this.sp++;
            this.pc+=4;
        }
        else if( op == OpCode.SM16 ){
            this.memory.setUint16(this.memory.getUint32(this.pc), this.memory.getUint32(this.sp));
            this.sp+=2;
            this.pc+=4;
        }
        else if( op == OpCode.SM32 ){
            this.memory.setUint32(this.memory.getUint32(this.pc), this.memory.getUint32(this.sp));
            this.sp+=4;
            this.pc+=4;
        }
        else if( op == OpCode.SM64 ){
            this.memory.setUint32(this.memory.getUint32(this.pc), this.memory.getUint32(this.sp));
            this.sp+=4;
            this.memory.setUint32(this.memory.getUint32(this.pc) + 4, this.memory.getUint32(this.sp));
            this.sp+=4;
            this.pc+=4;
        }
        else if( op == OpCode.ADD){
            this.memory.setInt32(this.sp + 4, this.memory.getInt32(this.sp) + this.memory.getInt32(this.sp + 4));
            this.sp += 4;
        }
        else if( op == OpCode.LI32){
            this.sp -= 4;
            this.memory.setInt32(this.sp, this.memory.getInt32(this.pc));
            this.pc += 4;
        }
        else if( op == OpCode.LUI32){
            this.sp -= 4;
            this.memory.setUint32(this.sp, this.memory.getUint32(this.pc));
            this.pc += 4;
        }
        else if( op == OpCode.PRINT){
            console.log(this.memory.getInt32(this.sp));
            this.pc+=4;
        }
    }
}