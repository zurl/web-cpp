/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {RuntimeError} from "../common/error";
import {OpCode, OpCodeLimit} from "../common/instruction";
import {JsAPIDefine} from "../common/jsapi";

export class VirtualMachine {
    public memory: DataView;
    public memoryUint8Array: Uint8Array;
    public pc: number;
    public bp: number;
    public sp: number;
    public jsAPIList: JsAPIDefine[];

    constructor(memory: DataView, jsAPIList: JsAPIDefine[] = []) {
        this.memory = memory;
        this.memoryUint8Array = new Uint8Array(memory.buffer);
        this.pc = 0;
        this.bp = memory.buffer.byteLength;
        this.sp = this.bp;
        this.jsAPIList = jsAPIList;
    }

    public popUint32(): number {
        const val = this.memory.getUint32(this.sp);
        this.sp += 4;
        return val;
    }
    public popInt32(): number {
        const val = this.memory.getInt32(this.sp);
        this.sp += 4;
        return val;
    }

    public runOneStep(): boolean {
        const op = this.memory.getUint8(this.pc);
        // console.log(`pc:${this.pc}, op:${OpCode[op]}, sp:${this.sp - this.memory.byteLength},` +
        //   `bp:${this.bp - this.memory.byteLength},`
        // + `stop_u32:${this.sp < this.memory.byteLength ? this.memory.getUint32(this.sp) : "???"}`);
        if (op <= OpCodeLimit.L1) {
            if (op <= OpCode.LM64) {
                const addr = this.memory.getUint32(this.sp);
                if (op === OpCode.LM8) {
                    this.memory.setUint32(this.sp, this.memory.getUint8(addr));
                } else if (op === OpCode.LM16) {
                    this.memory.setUint32(this.sp, this.memory.getUint16(addr));
                } else if (op === OpCode.LM32) {
                    this.memory.setUint32(this.sp, this.memory.getUint32(addr));
                } else if (op === OpCode.LM64) {
                    this.memory.setUint32(this.sp - 4, this.memory.getUint32(addr));
                    this.memory.setUint32(this.sp, this.memory.getUint32(addr + 4));
                    this.sp -= 4;
                }
            } else if (op <= OpCode.SM32) {
                const addr = this.popUint32();
                const item = this.popUint32();
                if (op === OpCode.SM8) {
                    this.memory.setUint8(addr, item);
                } else if (op === OpCode.SM16) {
                    this.memory.setUint16(addr, item);
                } else if (op === OpCode.SM32) {
                    this.memory.setUint32(addr, item);
                }
            } else if (op === OpCode.SM64) {
                const addr = this.popUint32();
                const i0 = this.popUint32();
                const i1 = this.popUint32();
                this.memory.setUint32(addr, i1);
                this.memory.setUint32(addr + 4, i0);
            } else if (op <= OpCode.MOD) {
                const i1 = this.memory.getInt32(this.sp);
                const i0 = this.memory.getInt32(this.sp + 4);
                let ret = 0;
                if (op === OpCode.ADD) {
                    ret = i0 + i1;
                } else if (op === OpCode.SUB) {
                    ret = i0 - i1;
                } else if (op === OpCode.MUL) {
                    ret = i0 * i1;
                } else if (op === OpCode.DIV) {
                    ret = parseInt((i0 / i1) as any);
                } else {
                    ret = i0 % i1;
                }
                this.memory.setInt32(this.sp + 4, ret);
                this.sp += 4;
            } else if (op <= OpCode.MODU) {
                const i1 = this.memory.getUint32(this.sp);
                const i0 = this.memory.getUint32(this.sp + 4);
                let ret = 0;
                if (op === OpCode.ADDU) {
                    ret = i0 + i1;
                } else if (op === OpCode.SUBU) {
                    ret = i0 - i1;
                } else if (op === OpCode.MULU) {
                    ret = i0 * i1;
                } else if (op === OpCode.DIVU) {
                    ret = parseInt((i0 / i1) as any);
                } else {
                    ret = i0 % i1;
                }
                this.memory.setUint32(this.sp + 4, ret);
                this.sp += 4;
            } else if (op <= OpCode.MODF) {
                const i1 = this.memory.getFloat64(this.sp);
                const i0 = this.memory.getFloat64(this.sp + 8);
                let ret = 0;
                if (op === OpCode.ADDF) {
                    ret = i0 + i1;
                } else if (op === OpCode.SUBF) {
                    ret = i0 - i1;
                } else if (op === OpCode.MULF) {
                    ret = i0 * i1;
                } else if (op === OpCode.DIVF) {
                    ret = i0 / i1;
                } else {
                    ret = i0 % i1;
                }
                this.memory.setFloat64(this.sp + 8, ret);
                this.sp += 8;
            } else if (op <= OpCode.GTE0) {
                const i0 = this.memory.getInt32(this.sp);
                if (op === OpCode.GT0) {
                    this.memory.setInt32(this.sp, +(i0 > 0));
                } else if (op === OpCode.GTE0) {
                    this.memory.setInt32(this.sp, +(i0 >= 0));
                } else if (op === OpCode.LT0) {
                    this.memory.setInt32(this.sp, +(i0 < 0));
                } else if (op === OpCode.LTE0) {
                    this.memory.setInt32(this.sp, +(i0 <= 0));
                } else if (op === OpCode.EQ0) {
                    this.memory.setInt32(this.sp, +(i0 === 0));
                } else if (op === OpCode.NEQ0) {
                    this.memory.setInt32(this.sp, +(i0 !== 0));
                }
            } else if (op === OpCode.I2U) {
                this.memory.setUint32(this.sp, this.memory.getInt32(this.sp));
            } else if (op === OpCode.U2I) {
                this.memory.setInt32(this.sp, this.memory.getUint32(this.sp));
            } else if (op === OpCode.D2I) {
                this.memory.setUint32(this.sp + 4, this.memory.getFloat64(this.sp));
                this.sp += 4;
            } else if (op === OpCode.I2D) {
                this.memory.setFloat64(this.sp - 4, this.memory.getInt32(this.sp));
                this.sp -= 4;
            } else if (op === OpCode.END) {
                return false;
            }
            this.pc++;
        } else if (op <= OpCodeLimit.L5U) {
            const imm = this.memory.getUint32(this.pc + 1);
            if (op === OpCode.PUI32 || op === OpCode.PDATA || op === OpCode.PBSS) {
                this.sp -= 4;
                this.memory.setUint32(this.sp, imm);
            } else if (op === OpCode.CALL) {
                this.memory.setUint32(this.sp - 4, this.pc + 5);
                this.memory.setUint32(this.sp - 8, this.bp);
                this.sp -= 8;
                this.bp = this.sp;
                this.pc = imm;
                return true;
            } else if (op === OpCode.LIBCALL) {
                if (imm > this.jsAPIList.length) {
                    throw new RuntimeError("non-exist LIBCALL");
                }
                this.jsAPIList[imm](this);
            } else if (op === OpCode.RET) {
                const t0 = this.sp;
                this.sp = this.bp + imm + 4;
                this.pc = this.memory.getUint32(this.bp + 4);
                this.bp = this.memory.getUint32(this.bp);
                this.memory.setUint32(this.sp, t0);
                return true;
            }
            this.pc += 5;
        } else if (op <= OpCodeLimit.L5I) {
            const imm = this.memory.getInt32(this.pc + 1);
            if (op === OpCode.PI32) {
                this.sp -= 4;
                this.memory.setInt32(this.sp, imm);
            } else if (op === OpCode.PBP) {
                this.sp -= 4;
                this.memory.setInt32(this.sp, this.bp + imm);
            } else if (op === OpCode.J) {
                this.pc = this.pc + imm;
                return true;
            } else if (op === OpCode.JZ) {
                this.sp += 4;
                if (this.memory.getInt32(this.sp - 4) === 0) {
                    this.pc = this.pc + imm;
                    return true;
                }
            } else if (op === OpCode.JNZ) {
                this.sp += 4;
                if (this.memory.getInt32(this.sp - 4) !== 0) {
                    this.pc = this.pc + imm;
                    return true;
                }
            } else if (op === OpCode.SSP) {
                this.sp = this.sp + imm;
            }
            this.pc += 5;
        } else if (op === OpCode.PF64) {
            const imm = this.memory.getFloat64(this.pc + 1);
            this.sp -= 8;
            this.memory.setFloat64(this.sp, imm);
            this.pc += 9;
        } else {
            throw new RuntimeError("unknown instruction");
        }
        return true;
    }
}
