/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {toHexString} from "./utils";
//          12|  param 2    |
//           8|  param 1    |
//           4|  saved $pc  |
//  $bp ->   0|  saved $bp  |
//          -4|  local 1    |
//          -8|  local 2    |
//  $sp -> -12|   retval    |
export enum OpCode{
    // 1 = [op]
    // S_TOP....  address  .....S_END
    LM8,LM16,LM32,LM64,
    // S_TOP....  address item .....S_END
    SM8,SM16,SM32,SM64,
    ADD,SUB,MUL,DIV,MOD,
    ADDU,SUBU,MULU,DIVU,MODU,
    ADDF,SUBF,MULF,DIVF,MODF,
    GT0,LT0,EQ0,NEQ0,LTE0,GTE0,
    NOP,END,PRINT,
    U2I,I2U,F2D,D2F,I2D,D2I,
    // 5 = [op u32 u32 u32 u32]
    PUI32, // push u32
    PDATA, // push $data + u32
    PBSS,  // push $bss + u32
    CALL,  // [++$sp] = $pc
           // [++$sp] = $bp
           // $bp = $sp
           // $pc = u32
    RET,   // t0 = $sp
           // $sp = $bp - 8
           // $bp = [$bp]
           // $pc = [$sp + 4]
           // push t0
    // 5 = [op i32 i32 i32 i32]
    PI32,  // push i32
    PBP,   // push $bp + i32
    SSP,   // $sp = $sp + i32
    J,     // $pc = $pc + i32
    JZ,    // if [$sp--] == 0: $pc = $pc + i32
    JNZ,   // if [$sp--] != 0: $pc = $pc + i32
    // 9 = [op f64 f64 f64 f64 f64 f64 f64 f64]
    PF64,  // push f64
}

export const OpCodeLimit = {
    L1: OpCode.D2I,
    L5U: OpCode.CALL,
    L5I: OpCode.JNZ
};

class BuilderError extends Error {}

function assertInt(value: string | number | undefined, min: number, max: number) {
    if (value === undefined || !(value.toString) || isNaN(parseInt(value.toString())))
        throw new BuilderError("invalid input");
    const val = parseInt(value.toString());
    if (value < min || value > max)
        throw new BuilderError("value range error");
}

function assertFloat(value: string | number | undefined) {
    if (value === undefined || !(value.toString) || isNaN(parseFloat(value.toString())))
        throw new BuilderError("invalid input");
}


export interface Assembly{
    code: DataView;
    size: number;
    unresolvedSymbols: [number, string][];
    sourceMap: [number, number][];
}

export class InstructionBuilder {
    codeBuffer: ArrayBuffer;
    codeView: DataView;
    now: number;
    unresolvedSymbols: [number, string][];
    sourceMap: [number, number][];
    labels: Map<number, string>;

    static showCode(code: DataView, options: any){
        const ib = new InstructionBuilder(0);
        ib.codeView = code;
        ib.now = code.buffer.byteLength;
        console.log(ib.toString(options));
    }

    constructor(maxLength: number) {
        this.now = 0;
        this.codeBuffer = new ArrayBuffer(maxLength);
        this.codeView = new DataView(this.codeBuffer);
        this.unresolvedSymbols = [];
        this.sourceMap = [];
        this.labels = new Map<number, string>();
    }

    fromText(source: string){
        source.split("\n")
            .filter(line => line)
            .map(line => line.split(" "))
            .map( (line, i) => this.build(
                // TODO:: fucking typescript why :any required?
                i,
                parseInt((OpCode as any)[line[0]]),
                line[1]
            ));
    }

    build(line:number, op: OpCode, imm: string | number | undefined) {
        this.sourceMap.push([this.now, line]);
        if (op <= OpCodeLimit.L1) {
            this.codeView.setUint8(this.now++, op);
        }
        else if (op <= OpCodeLimit.L5U) {
            assertInt(imm, 0, 0xFFFFFFFF);
            this.codeView.setUint8(this.now++, op);
            this.codeView.setInt32(this.now, parseInt(imm as string));
            this.now += 4;
        }
        else if (op <= OpCodeLimit.L5I){
            assertInt(imm, -0x80000000, 0x7FFFFFFF);
            this.codeView.setUint8(this.now++, op);
            this.codeView.setUint32(this.now, parseInt(imm as string));
            this.now += 4;
        }
        else if( op === OpCode.PF64){
            assertFloat(imm);
            this.codeView.setUint8(this.now++, op);
            this.codeView.setFloat64(this.now, parseFloat(imm as string));
            this.now += 8;
        }
    }

    toString(options: {
        withLabel?: boolean,
        withAddress?: boolean,
        withSourceMap?:boolean,
        friendlyJMP?: boolean,
        sourceMap?: Map<number, [string, number]>
        source?: { [key: string]: string[] }
    } = {}) {
        let i = 0, result = "";
        let lastFileName = "", lastFile = [] as string[], lastLine = -1;
        while (i < this.now) {
            if( options.withLabel && this.labels.get(i)){
                result += `${this.labels.get(i)}:\n`;
            }
            if(options.withSourceMap && options.sourceMap && options.source){
                const item = options.sourceMap.get(i);
                if( item ){
                    if( item[0] != lastFileName){
                        result += `>>>${item[0]}:\n`;
                        lastFileName = item[0];
                        lastFile = options.source[lastFileName];
                        lastLine = item[1] - 1;
                    }
                    if( item[1] != lastLine){
                        for(let i = lastLine + 1; i <= item[1]; i++){
                            result += `#${i}:` + lastFile[i - 1] + "\n";
                        }
                        lastLine = item[1];
                    }
                }
            }
            if( options.withAddress ){
                result += toHexString(i);
            }
            const op = this.codeView.getUint8(i);
            i++;
            if (op <= OpCodeLimit.L1) {
                result += `\t${OpCode[op]}`;
            }
            else if( op <= OpCodeLimit.L5U){
                result += `\t${OpCode[op]} ${toHexString(this.codeView.getUint32(i))}`;
                i += 4;
            }
            else if (op <= OpCodeLimit.L5I) {
                result += `\t${OpCode[op]} ${this.codeView.getInt32(i)}`;
                i += 4;
            }
            else if (op == OpCode.PF64) {
                result += `\t${OpCode[op]} ${this.codeView.getFloat64(i)}`;
                i += 8;
            }
            result += "\n";
        }
        return result;
    }


    unresolve(name: string){
        this.unresolvedSymbols.push([this.now, name]);
    }

    toAssembly(): Assembly{
        return {
            code: this.codeView,
            size: this.now,
            unresolvedSymbols: this.unresolvedSymbols,
            sourceMap: this.sourceMap
        };
    }
}
