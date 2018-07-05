/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {InternalError} from "./error";
import {Variable} from "./type";
import {
    CharType, DoubleType,
    FloatType,
    Int16Type,
    Int32Type, PrimitiveTypes, QualifiedType,
    UnsignedCharType,
    UnsignedInt16Type,
    UnsignedInt32Type, VariableStorageType,
} from "./type";
import {fromBytesToString, toHexString} from "./utils";
//          12|  param 2    |
//           8|  param 1    |
//           4|  saved $pc  | => ret addr
//  $bp ->   0|  saved $bp  |
//          -4|  local 1    |
//          -8|  local 2    |
//  $sp -> -12|   retval    |
export enum OpCode {
    // 1 = [op]
    // S_HIGH....  address  .....S_LOW
    LM8, LM16, LM32, LM64,
    // S_HIGH.... item address .....S_LOW
    SM8, SM16, SM32, SM64,
    ADD, SUB, MUL, DIV, MOD,
    SHL, SHR, LAND, LOR, XOR, AND, OR,
    NOT, NEG, INV,
    ADDU, SUBU, MULU, DIVU, SHRU, MODU,
    ADDF, SUBF, MULF, DIVF, MODF,
    GT0, LT0, EQ0, NEQ0, LTE0, GTE0,
    NOP, PRINT, // <== no impl
    END,
    U2I, I2U, F2D, D2F, I2D, D2I,
    // 5 = [op u32 u32 u32 u32]
    PUI32, // push u32
    PDATA, // push $data + u32
    PBSS,  // push $bss + u32
    LIBCALL,
    CALL,  // [--$sp] = $pc
           // [--$sp] = $bp
           // $bp = $sp
           // $pc = u32
    RET,   // t0 = $sp
           // $sp = $bp + u32 + 8
           // $pc = [$bp + 4]
           // $bp = [$bp]
           // push t0
    // 5 = [op i32 i32 i32 i32]
    PI32,  // push i32
    PBP,   // push $bp + i32
    SSP,   // $sp = $sp + i32
    J,     // $pc = $pc + i32
    JZ,    // if [$sp++] == 0: $pc = $pc + i32
    JNZ,   // if [$sp++] != 0: $pc = $pc + i32
    // 9 = [op f64 f64 f64 f64 f64 f64 f64 f64]
    PF64,  // push f64
}

export const OpCodeLimit = {
    L1: OpCode.D2I,
    L5U: OpCode.RET,
    L5I: OpCode.JNZ,
};

class BuilderError extends Error {
}

function assertInt(value: string | number | undefined, min: number, max: number) {
    if (value === undefined || !(value.toString) || isNaN(parseInt(value.toString()))) {
        throw new BuilderError("invalid input");
    }
    const val = parseInt(value.toString());
    if (value < min || value > max) {
        throw new BuilderError("value range error");
    }
}

function assertFloat(value: string | number | undefined) {
    if (value === undefined || !(value.toString) || isNaN(parseFloat(value.toString()))) {
        throw new BuilderError("invalid input");
    }
}

export interface Assembly {
    code: DataView;
    size: number;
    unresolvedSymbols: Array<[number, string]>;
    sourceMap: Array<[number, number]>;
}

interface InstructionDumpOptions {
    withLabel?: boolean;
    withAddress?: boolean;
    withSourceMap?: boolean;
    friendlyJMP?: boolean;
    sourceMap?: Map<number, [string, number]>;
    source?: { [key: string]: string[] };
    dataStart?: number;
    dataMap?: Map<number, Variable>;
}

export class InstructionBuilder {

    public static showCode(code: DataView, options: InstructionDumpOptions) {
        const ib = new InstructionBuilder(0);
        ib.codeView = code;
        ib.now = code.buffer.byteLength;
        console.log(ib.toString(options));
    }

    public codeBuffer: ArrayBuffer;
    public codeView: DataView;
    public now: number;
    public unresolvedSymbols: Array<[number, string]>;
    public sourceMap: Array<[number, number]>;
    public labels: Map<number, string>;

    constructor(maxLength: number) {
        this.now = 0;
        this.codeBuffer = new ArrayBuffer(maxLength);
        this.codeView = new DataView(this.codeBuffer);
        this.unresolvedSymbols = [];
        this.sourceMap = [];
        this.labels = new Map<number, string>();
    }

    public fromText(source: string) {
        source.split("\n")
            .filter((line) => line)
            .map((line) => line.split(" ").filter((x) => x))
            .filter((x) => x.length >= 1)
            .map((x) => {
                if (!(OpCode as any).hasOwnProperty(x[0])) {
                    throw new InternalError(`unknown op ${x[0]}`);
                }
                return x;
            })
            .map((line, i) => this.build(
                // TODO:: fucking typescript why :any required?
                i,
                parseInt((OpCode as any)[line[0]]),
                line[1],
            ));
    }

    public build(line: number, op: OpCode, imm: string | number | undefined) {
        this.sourceMap.push([this.now, line]);
        if (op <= OpCodeLimit.L1) {
            this.codeView.setUint8(this.now++, op);
        } else if (op <= OpCodeLimit.L5U) {
            assertInt(imm, 0, 0xFFFFFFFF);
            this.codeView.setUint8(this.now++, op);
            this.codeView.setInt32(this.now, parseInt(imm as string));
            this.now += 4;
        } else if (op <= OpCodeLimit.L5I) {
            assertInt(imm, -0x80000000, 0x7FFFFFFF);
            this.codeView.setUint8(this.now++, op);
            this.codeView.setUint32(this.now, parseInt(imm as string));
            this.now += 4;
        } else if (op === OpCode.PF64) {
            assertFloat(imm);
            this.codeView.setUint8(this.now++, op);
            this.codeView.setFloat64(this.now, parseFloat(imm as string));
            this.now += 8;
        } else {
            throw new InternalError(`unknown op ${op} ${imm}`);
        }
    }

    public toString(options: InstructionDumpOptions = {}) {
        let i = 0, result = "";
        let lastFileName = "", lastFile = [] as string[], lastLine = -1;
        const limit = options.dataStart ? options.dataStart : this.now;
        while (i < limit) {
            if (options.withLabel && this.labels.get(i)) {
                result += `${this.labels.get(i)}:\n`;
            }
            if (options.withSourceMap && options.sourceMap && options.source) {
                const item = options.sourceMap.get(i);
                if (item) {
                    if (item[0] !== lastFileName) {
                        result += `>>>${item[0]}:\n`;
                        lastFileName = item[0];
                        lastFile = options.source[lastFileName];
                        lastLine = item[1] - 1;
                    }
                    if (item[1] !== lastLine) {
                        for (let j = lastLine + 1; j <= item[1]; j++) {
                            result += `#${j}:` + lastFile[j - 1] + "\n";
                        }
                        lastLine = item[1];
                    }
                }
            }
            if (options.withAddress) {
                result += toHexString(i);
            }
            const op = this.codeView.getUint8(i);
            i++;
            if (op <= OpCodeLimit.L1) {
                result += `\t${OpCode[op]}`;
            } else if (op <= OpCodeLimit.L5U) {
                result += `\t${OpCode[op]} ${toHexString(this.codeView.getUint32(i))}`;
                i += 4;
            } else if (op <= OpCodeLimit.L5I) {
                result += `\t${OpCode[op]} ${this.codeView.getInt32(i)}`;
                i += 4;
            } else if (op === OpCode.PF64) {
                result += `\t${OpCode[op]} ${this.codeView.getFloat64(i)}`;
                i += 8;
            }
            result += "\n";
        }
        if (options.dataStart) {
            result += this.dumpData(options.dataStart, options.dataMap!);
        }
        return result;
    }

    public dumpData(dataStart: number, dataMap: Map<number, Variable>): string {
        let result = "DATA:\n";
        for (const line of dataMap.keys()) {
            const item = dataMap.get(line)!;
            if ( item.storageType !== VariableStorageType.MEMORY_DATA) {
                continue;
            }
            result += toHexString(line) + "\t" + item.fileName + "@" + item.name + "\t:\t";
            let itemType = item.type;
            while ( itemType instanceof QualifiedType) {
                itemType = itemType.elementType;
            }
            if ( itemType instanceof UnsignedCharType) {
                result += this.codeView.getUint8(line);
            } else if ( itemType instanceof CharType) {
                result += this.codeView.getInt8(line);
            } else if ( itemType instanceof UnsignedInt16Type) {
                result += this.codeView.getUint16(line);
            } else if ( itemType instanceof UnsignedInt32Type) {
                result += this.codeView.getUint32(line);
            } else if ( itemType instanceof Int16Type) {
                result += this.codeView.getInt16(line);
            } else if ( itemType instanceof Int32Type) {
                result += this.codeView.getInt32(line);
            } else if ( itemType instanceof FloatType) {
                result += this.codeView.getFloat32(line);
            } else if ( itemType instanceof DoubleType) {
                result += this.codeView.getFloat64(line);
            } else if ( itemType.equals(PrimitiveTypes.__charptr) || itemType.equals(PrimitiveTypes.__ccharptr)) {
                result += `"${fromBytesToString(this.codeView, this.codeView.getUint32(line))}"`;
            }
            result += `[${item.type}]`;
            result += "\n";
        }
        return result;
    }

    public toAssembly(): Assembly {
        return {
            code: this.codeView,
            size: this.now,
            unresolvedSymbols: this.unresolvedSymbols,
            sourceMap: this.sourceMap,
        };
    }

    public unresolve(name: string) {
        this.unresolvedSymbols.push([this.now, name]);
    }
}
