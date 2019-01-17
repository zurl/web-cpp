/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {Control, getNativeType, OpCodes, SectionCode, WType} from "./constant";
import {Emitter, JSONEmitter, WASMInstruction} from "./emitter";
import {WConst} from "./expression";
import {getLeb128UintLength} from "./leb128";
import {getArrayLength, WExpression, WNode, WSection, WStatement} from "./node";
import {getUtf8StringLength} from "./utf8";

export class WFunction extends WNode {
    public name: string;
    public type: WFunctionType;
    public local: WType[];
    public body: WStatement[];
    public signatureId: number;
    public displayName: string;

    // fill in linking
    public dataStart: number;
    public bssStart: number;
    public fileName: string;

    constructor(name: string, displayName: string, returnType: WType[], parameters: WType[],
                local: WType[], body: WStatement[], location?: SourceLocation) {
        super(location);
        this.name = name;
        this.displayName = displayName;
        this.type = new WFunctionType(returnType, parameters, location);
        this.local = local;
        this.body = body;
        this.signatureId = 0;

        // fill in linking
        this.dataStart = 0;
        this.bssStart = 0;
        this.fileName = "";
    }

    public emit(e: Emitter): void {
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.local.length);
        this.local.map((x) => {
            e.writeUint32(1);
            e.writeByte(getNativeType(x));
        });
        e.setCurrentFunc(this);
        this.body.map((stmt) => stmt.emit(e));
        e.setCurrentFunc();
        e.writeByte(Control.end);
    }

    public emitJSON(e: JSONEmitter): void {
        const codes = [] as WASMInstruction[];
        e.setBuffer(codes);
        if (this.location) {
            e.setSourceMap(this.location!.fileName);
        } else {
            e.setSourceMap("");
        }
        e.setCurrentFunc(this);
        this.body.map((stmt) => stmt.emitJSON(e));
        e.setCurrentFunc();

        // match the block/end pair
        const stack = [];
        for (let i = 0; i < codes.length; i++) {
            if (codes[i][0] === Control.if || codes[i][0] === Control.block || codes[i][0] === Control.loop) {
                stack.push(i);
            } else if (codes[i][0] === Control.else) {
                codes[stack[stack.length - 1]][1] = i;
                stack.pop();
                stack.push(i);
            } else if (codes[i][0] === Control.end) {
                codes[stack[stack.length - 1]][1] = i;
                stack.pop();
            }
        }
        codes.push([Control.return, 0, -1]);

        // build inverse idx
        const inverseIdx = new Set<number>();
        const lineIdx = new Set<number>();
        for (let i = 0; i < codes.length; i++) {
            if (codes[i][2] !== -1 && !inverseIdx.has(codes[i][2])) {
                inverseIdx.add(codes[i][2]);
                lineIdx.add(i);
            }
        }
        e.getJSON().functions.push({
            name: this.name,
            fileName: this.fileName,
            displayName: this.displayName,
            locals: this.local.map((x) => getNativeType(x)),
            codes,
            type: this.type.toEncoding(),
            signatureId: this.signatureId,
            lineIdx,
            dataStart: this.dataStart,
            bssStart: this.bssStart,
            scope: null,
        });
    }

    public getBodyLength(e: Emitter): number {
        e.setCurrentFunc(this);
        const result = getLeb128UintLength(this.local.length) +
            getArrayLength(this.local, (x) => 1 + getLeb128UintLength(x)) +
            getArrayLength(this.body, (x) => x.length(e)) + 1;
        e.setCurrentFunc();
        return result;
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e);
    }

    public dump(e: Emitter): void {
        const params = this.type.parameters.map(
            (x, i) => WType[x] + `:$${i}`).join(", ");
        const results = this.type.returnTypes.map(
            (x, i) => WType[x]).join(", ");
        const locals = this.local.map(
            (x, i) => WType[x] + `:$${i + this.type.parameters.length}`).join(", ");
        e.dump(`(func ${this.name} (param ${params}) (result ${results})`, this.location);
        e.changeDumpIndent(1);
        e.dump(`(locals ${locals})`, this.location);
        e.setCurrentFunc(this);
        this.body.map((x) => x.dump(e));
        e.setCurrentFunc();
        e.changeDumpIndent(-1);
        e.dump(")", this.location);
    }

    public optimize(e: Emitter): void {
        this.body.map((x) => x.optimize(e));
    }

}

export class WFunctionType extends WNode {

    public static n2s(x: number): string {
        if (x === WType.i32) { return "i"; }
        if (x === WType.i64) { return "l"; }
        if (x === WType.f32) { return "f"; }
        if (x === WType.f64) { return "d"; }
        return "v";
    }

    public static s2n(x: string): WType {
        if (x === "i") { return WType.i32; }
        if (x === "l") { return WType.i64; }
        if (x === "f") { return WType.f32; }
        if (x === "d") { return WType.f64; }
        return WType.none;
    }

    public static fromEncoding(encoding: string, location?: SourceLocation) {
        const result = new WFunctionType([], [], location);
        if (encoding.charAt(0) !== "v") {
            result.returnTypes.push(WFunctionType.s2n(encoding.charAt(0)));
        }
        for (let i = 1; i < encoding.length; i++) {
            result.parameters.push(WFunctionType.s2n(encoding.charAt(i)));
        }
        return result;
    }

    public returnTypes: WType[];
    public parameters: WType[];

    constructor(returnTypes: WType[], parameters: WType[], location?: SourceLocation) {
        super(location);
        this.returnTypes = returnTypes;
        this.parameters = parameters;
    }

    public emit(e: Emitter): void {
        e.writeByte(0x60);
        e.writeUint32(this.parameters.length);
        this.parameters.map((type) => e.writeUint32(getNativeType(type)));
        e.writeUint32(this.returnTypes.length);
        this.returnTypes.map((type) => e.writeUint32(getNativeType(type)));
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public toString(): string {
        return this.parameters.join(",") + "#" + this.returnTypes.join(",");
    }

    public length(e: Emitter): number {
        return 1 +
            getLeb128UintLength(this.returnTypes.length) + this.returnTypes.length +
            getLeb128UintLength(this.parameters.length) + this.parameters.length;
    }

    public dump(e: Emitter) {
        e.dump(`(function)`, this.location);
    }

    public toEncoding(): string {
        let result = "";
        if (this.returnTypes.length === 0) {
            result += "v";
        } else {
            result += WFunctionType.n2s(getNativeType(this.returnTypes[0]));
        }
        this.parameters.map((ty) => result += WFunctionType.n2s(getNativeType(ty)));
        return result;
    }

}

export class WMemorySection extends WNode {
    public pageInfo: Array<[number, number | null]>;

    constructor(pageInfo: Array<[number, (number | null)]>, location?: SourceLocation) {
        super(location);
        this.pageInfo = pageInfo;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.memory);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.pageInfo.length);
        this.pageInfo.map((tuple) => {
            const val = tuple[1];
            if (val === null) {
                e.writeByte(0x00);
                e.writeUint32(tuple[0]);
            } else {
                e.writeByte(0x01);
                e.writeUint32(tuple[0]);
                e.writeUint32(val);
            }
        });
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.pageInfo.length) +
            getArrayLength(this.pageInfo, (tuple) => {
                const val = tuple[1];
                if (val === null) {
                    return 1 + getLeb128UintLength(tuple[0]);
                } else {
                    return 1
                        + getLeb128UintLength(tuple[0])
                        + getLeb128UintLength(val);
                }
            });
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(memory)`, this.location);
    }
}

export class WTypeSection extends WSection {
    public types: WFunctionType[];

    constructor(types: WFunctionType[], location?: SourceLocation) {
        super(location);
        this.types = types;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.type);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.types.length);
        for (let i = 0; i < this.types.length; i++) {
            e.setTypeIdxFromEncoding(this.types[i].toEncoding(), i);
            this.types[i].emit(e);
        }
    }

    public emitJSON(e: JSONEmitter): void {
        for (let i = 0; i < this.types.length; i++) {
            e.setTypeIdxFromEncoding(this.types[i].toEncoding(), i);
        }
        e.getJSON().types = this.types.map( (x) => x.toEncoding());
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.types.length) +
            getArrayLength(this.types, (type) => type.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(type)`, this.location);
    }
}

export class WFunctionSection extends WSection {
    public functions: WFunction[];

    constructor(functions: WFunction[], location?: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.function);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.functions.length);
        this.functions.map((x) => e.setFuncIdx(x.name, x.type));
        this.functions.map((x) => e.writeUint32(x.signatureId));
    }

    public emitJSON(e: JSONEmitter): void {
        this.functions.map((x) => e.setFuncIdx(x.name, x.type));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => getLeb128UintLength(x.signatureId));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(function)`, this.location);
    }
}

export class WCodeSection extends WSection {
    public functions: WFunction[];

    constructor(functions: WFunction[], location?: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.code);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.functions.length);
        this.functions.map((func) => func.emit(e));
    }

    public emitJSON(e: JSONEmitter): void {
        this.functions.map((x) => x.emitJSON(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter): void {
        this.functions.map((x) => x.dump(e));
    }

    public optimize(e: Emitter): void {
        this.functions.map((x) => x.optimize(e));
    }

}

export class WImportItem extends WNode {
    public module: string;
    public name: string;

    constructor(module: string, name: string, location?: SourceLocation) {
        super(location);
        this.module = module;
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.writeUtf8String(this.module);
        e.writeUtf8String(this.name);
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public length(e: Emitter): number {
        return getUtf8StringLength(this.module) +
            getUtf8StringLength(this.name);
    }

    public dump(e: Emitter) {
        e.dump(`(import)`, this.location);
    }

}

export class WImportFunction extends WImportItem {

    public type: WFunctionType;
    public signatureId: number;

    constructor(module: string, name: string, returnType: WType[],
                parameters: WType[], location?: SourceLocation) {
        super(module, name, location);
        this.module = module;
        this.name = name;
        this.type = new WFunctionType(returnType, parameters, this.location);
        this.signatureId = 0;
    }

    public emit(e: Emitter): void {
        super.emit(e);
        e.writeByte(0x00);
        e.writeUint32(this.signatureId);
        e.setFuncIdx(this.name, this.type);
    }

    public emitJSON(e: JSONEmitter): void {
        e.getJSON().imports.push({
            module: this.module,
            name: this.name,
            type: this.type.toEncoding(),
        });
        e.setFuncIdx(this.name, this.type);
    }

    public length(e: Emitter): number {
        return super.length(e) +
            getLeb128UintLength(this.signatureId) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(import)`, this.location);
    }
}

export class WImportMemory extends WImportItem {
    public min: number;
    public max: number | null;

    constructor(module: string, name: string, min: number, max: number | null, location?: SourceLocation) {
        super(module, name, location);
        this.min = min;
        this.max = max;
    }

    public emit(e: Emitter): void {
        super.emit(e);
        e.writeByte(0x02);
        if (this.max === null) {
            e.writeByte(0x00);
            e.writeUint32(this.min);
        } else {
            e.writeByte(0x01);
            e.writeByte(this.min);
            e.writeByte(this.max);
        }
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public length(e: Emitter): number {
        if (this.max === null) {
            return super.length(e) + 2 + getLeb128UintLength(this.min);
        } else {
            return super.length(e) + 2 + getLeb128UintLength(this.min) +
                getLeb128UintLength(this.max);
        }
    }

    public dump(e: Emitter) {
        e.dump(`(import memory)`, this.location);
    }
}

export class WImportSection extends WNode {
    public imports: WImportItem[];

    constructor(imports: WImportItem[],
                location?: SourceLocation) {
        super(location);
        this.imports = imports;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.import);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.imports.length);
        this.imports.map((x) => x.emit(e));
    }

    public emitJSON(e: JSONEmitter): void {
        this.imports.map((x) => x.emitJSON(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.imports.length) +
            getArrayLength(this.imports, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(import)`, this.location);
    }
}

export class WExportFunction extends WNode {
    public name: string;

    constructor(name: string, location?: SourceLocation) {
        super(location);
        this.name = name;
    }

    public emit(e: Emitter): void {
        e.writeUtf8String(this.name);
        e.writeByte(0x00);
        e.writeUint32(e.getFuncIdx(this.name));
    }

    public emitJSON(e: JSONEmitter): void {
        e.getJSON().exports[this.name] = e.getFuncIdx(this.name);
    }

    public length(e: Emitter): number {
        return getUtf8StringLength(this.name) +
            getLeb128UintLength(e.getFuncIdx(this.name)) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(export)`, this.location);
    }

}

export class WExportSection extends WSection {
    public functions: WExportFunction[];

    constructor(functions: WExportFunction[], location?: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.export);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.functions.length);
        this.functions.map((func) => func.emit(e));
    }

    public emitJSON(e: JSONEmitter): void {
        this.functions.map((func) => func.emitJSON(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(export)`, this.location);
    }
}

export class WGlobalVariable extends WNode {
    public name: string;
    public type: WType;
    public init: WExpression;

    constructor(name: string, type: WType, init: WExpression, location?: SourceLocation) {
        super(location);
        this.name = name;
        this.type = type;
        this.init = init;
    }

    public emit(e: Emitter): void {
        e.setGlobalIdx(this.name, this.type);
        e.writeByte(getNativeType(this.type));
        e.writeByte(0x01); // mutable
        this.init.emit(e);
        e.writeByte(Control.end);
    }

    public emitJSON(e: JSONEmitter): void {
        e.setGlobalIdx(this.name, this.type);
        if (this.init instanceof WConst) {
            e.getJSON().globals.push({
                name: this.name,
                type: getNativeType(this.type),
                init: this.init.constant,
            });
        } else {
            throw new Error("WASM emitJSON: could not handle");
        }
    }

    public length(e: Emitter): number {
        return 3 + this.init.length(e);
    }

    public dump(e: Emitter) {
        e.dump(`(global)`, this.location);
    }
}

export class WGlobalSection extends WSection {
    public globals: WGlobalVariable[];

    constructor(functions: WGlobalVariable[], location?: SourceLocation) {
        super(location);
        this.globals = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.global);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.globals.length);
        this.globals.map((x) => x.emit(e));
    }

    public emitJSON(e: JSONEmitter): void {
        this.globals.map((x) => x.emitJSON(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.globals.length) +
            getArrayLength(this.globals, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(global)`, this.location);
    }
}

export class WTable extends WNode {

    public len: number;

    constructor(len: number, location?: SourceLocation) {
        super(location);
        this.len = len;
    }

    public emit(e: Emitter): void {
        e.writeByte(0x70);
        e.writeByte(0x00);
        e.writeUint32(this.len);
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public length(e: Emitter): number {
        return 2 + getLeb128UintLength(this.len);
    }

    public dump(e: Emitter) {
        e.dump(`(table)`, this.location);
    }
}

export class WTableSection extends WSection {

    public tables: WTable[];

    constructor(tables: WTable[], location?: SourceLocation) {
        super(location);
        this.tables = tables;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.table);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.tables.length);
        this.tables.map((x) => x.emit(e));
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.tables.length) +
            getArrayLength(this.tables, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(global)`, this.location);
    }
}

export class WDataSegment extends WNode {
    public memIdx: number;
    public offset: WExpression;
    public dataBuffer: ArrayBuffer;
    public offsetNumber: number;

    constructor(offset: number, dataBuffer: ArrayBuffer, location?: SourceLocation) {
        super(location);
        this.memIdx = 0;
        this.offsetNumber = offset;
        this.offset = new WConst(WType.i32, offset.toString(), location);
        this.dataBuffer = dataBuffer;
    }

    public emit(e: Emitter): void {
        e.writeUint32(this.memIdx);
        this.offset.emit(e);
        e.writeByte(Control.end);
        e.writeUint32(this.dataBuffer.byteLength);
        const ui8a = new Uint8Array(this.dataBuffer);
        for (let i = 0; i < this.dataBuffer.byteLength; i++) {
            e.writeByte(ui8a[i]);
        }
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public length(e: Emitter): number {
        return 1 + getLeb128UintLength(this.memIdx) +
            this.offset.length(e) + this.dataBuffer.byteLength +
            getLeb128UintLength(this.dataBuffer.byteLength);
    }

    public dump(e: Emitter) {
        e.dump(`(idx=${this.memIdx} off=${(this.offset as WConst).constant} ${this.dataBuffer})`);
    }

}

export class WDataSection extends WSection {
    public segments: WDataSegment[];

    constructor(segments: WDataSegment[], location?: SourceLocation) {
        super(location);
        this.segments = segments;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.data);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.segments.length);
        this.segments.map((x) => x.emit(e));
    }

    public emitJSON(e: JSONEmitter): void {
        e.getJSON().data = this.segments.map((x) => ({
            offset: x.offsetNumber,
            data: x.dataBuffer,
        }));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.segments.length) +
            getArrayLength(this.segments, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter) {
        e.dump(`(data`, this.location);
        e.changeDumpIndent(1);
        this.segments.map((x) => x.dump(e));
        e.changeDumpIndent(-1);
        e.dump(`)`, this.location);
    }
}

export class WElement extends WNode {

    public len: number;
    public offset: WExpression;

    constructor(idx: number, location?: SourceLocation) {
        super(location);
        this.len = idx;
        this.offset = new WConst(WType.i32, "0", location);
    }

    public emit(e: Emitter): void {
        e.writeByte(0x00); // table idx
        this.offset.emit(e);
        e.writeByte(Control.end);
        e.writeUint32(this.len);
        for (let i = 0; i < this.len; i++) {
            e.writeUint32(i);
        }
    }

    public emitJSON(e: JSONEmitter): void { return; }

    public length(e: Emitter): number {
        let len = 2 + this.offset.length(e) + getLeb128UintLength(this.len);
        for (let i = 0; i < this.len; i++) {
            len += getLeb128UintLength(i);
        }
        return len;
    }

    public dump(e: Emitter): void {
        e.dump(`(elem)`, this.location);
    }
}

export class WElementSection extends WSection {
    public elems: WElement[];

    constructor(len: number, location?: SourceLocation) {
        super(location);
        this.elems = [new WElement(len, location)];
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.element);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.elems.length);
        this.elems.map((x) => x.emit(e));
    }

    public emitJSON(e: JSONEmitter): void {
        return;
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.elems.length) +
            getArrayLength(this.elems, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

    public dump(e: Emitter): void {
        e.dump(`(elem)`, this.location);
    }

}

export interface WModuleConfig {
    functions: WFunction[];
    imports: WImportItem[];
    exports: string[];
    globals: WGlobalVariable[];
    data: WDataSegment[];
    generateMemory: boolean;
    requiredFuncTypes: string[];
}

export class WModule extends WNode {
    public typeSection: WTypeSection;
    public importSection: WImportSection;
    public functionSection: WFunctionSection;
    public memorySection: WMemorySection;
    public globalSection: WGlobalSection;
    public exportSection: WExportSection;
    public codeSection: WCodeSection;
    public dataSection: WDataSection;
    public tableSection: WTableSection;
    public elementSection: WElementSection;
    public generateMemory: boolean;
    public functions: WFunction[];
    public importFunctions: WImportFunction[];
    public funcTypes: WFunctionType[];

    constructor(config: WModuleConfig, location?: SourceLocation) {
        super(location);

        this.functions = config.functions;

        this.funcTypes = [];
        this.importFunctions =
            config.imports.filter((x) => x instanceof WImportFunction)
                .map((x) => x as WImportFunction);

        for (const func of [...this.importFunctions, ...config.functions]) {
            func.signatureId = this.funcTypes.length;
            this.funcTypes.push(func.type);
        }

        const funcLen = this.funcTypes.length;
        for (const encoding of config.requiredFuncTypes) {
            this.funcTypes.push(WFunctionType.fromEncoding(encoding, this.location));
        }

        this.generateMemory = config.generateMemory;

        const exports = config.exports.map((x) => new WExportFunction(x, this.location));

        this.globalSection = new WGlobalSection(config.globals, this.location);
        this.importSection = new WImportSection(config.imports, this.location);
        this.memorySection = new WMemorySection([[2, null]], this.location);
        this.functionSection = new WFunctionSection(config.functions, this.location);
        this.typeSection = new WTypeSection(this.funcTypes, this.location);
        this.codeSection = new WCodeSection(config.functions, this.location);
        this.exportSection = new WExportSection(exports, this.location);
        this.dataSection = new WDataSection(config.data, this.location);
        this.tableSection = new WTableSection([new WTable(funcLen, this.location)], this.location);
        this.elementSection = new WElementSection(funcLen, this.location);
    }

    public emit(e: Emitter): void {
        e.writeBytes([0x00, 0x61, 0x73, 0x6D]);
        e.writeBytes([0x01, 0x00, 0x00, 0x00]);
        this.typeSection.emit(e);
        this.importSection.emit(e);
        this.functionSection.emit(e);
        this.tableSection.emit(e);
        if (this.generateMemory) {
            this.memorySection.emit(e);
        }
        this.globalSection.emit(e);
        this.exportSection.emit(e);
        this.elementSection.emit(e);
        this.codeSection.emit(e);
        this.dataSection.emit(e);
    }

    public emitJSON(e: JSONEmitter): void {
        e.writeBytes([0x00, 0x61, 0x73, 0x6D]);
        e.writeBytes([0x01, 0x00, 0x00, 0x00]);
        this.typeSection.emitJSON(e);
        this.importSection.emitJSON(e);
        this.functionSection.emitJSON(e);
        this.tableSection.emitJSON(e);
        if (this.generateMemory) {
            this.memorySection.emitJSON(e);
        }
        this.globalSection.emitJSON(e);
        this.exportSection.emitJSON(e);
        this.elementSection.emitJSON(e);
        this.codeSection.emitJSON(e);
        this.dataSection.emitJSON(e);
    }

    public length(e: Emitter): number {
        return 0;
    }

    public dump(e: Emitter): void {
        this.functionSection.emit(e);
        this.codeSection.dump(e);
    }

    public optimize(e: Emitter): void {
        this.codeSection.optimize(e);
    }
}
