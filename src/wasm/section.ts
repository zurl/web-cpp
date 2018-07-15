/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {SourceLocation} from "../common/ast";
import {Control, getNativeType, SectionCode, WType} from "./constant";
import {Emitter} from "./emitter";
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

    // fill in linking
    public dataStart: number;
    public bssStart: number;
    public fileName: string;

    constructor(name: string, returnType: WType[], parameters: WType[],
                local: WType[], body: WStatement[], location?: SourceLocation) {
        super(location);
        this.name = name;
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

}

export class WFunctionType extends WNode {
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
        this.parameters.map((type) => e.writeUint32(type));
        e.writeUint32(this.returnTypes.length);
        this.returnTypes.map((type) => e.writeUint32(type));
    }

    public toString(): string {
        return this.returnTypes.join(",") + "#" + this.parameters.join(",");
    }

    public length(e: Emitter): number {
        return 1 +
            getLeb128UintLength(this.returnTypes.length) +
            getLeb128UintLength(this.parameters.length) +
            getArrayLength(this.returnTypes, (x) => getLeb128UintLength(x)) +
            getArrayLength(this.parameters, (x) => getLeb128UintLength(x));
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
}

class WTypeSection extends WSection {
    public types: WFunctionType[];

    constructor(types: WFunctionType[], location?: SourceLocation) {
        super(location);
        this.types = types;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.type);
        e.writeUint32(this.getBodyLength(e));
        e.writeUint32(this.types.length);
        this.types.map((type) => type.emit(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.types.length) +
            getArrayLength(this.types, (type) => type.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

}

class WFunctionSection extends WSection {
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

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => getLeb128UintLength(x.signatureId));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }
}

class WCodeSection extends WSection {
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

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }

}

export class WImportFunction extends WNode {
    public module: string;
    public name: string;
    public type: WFunctionType;
    public signatureId: number;

    constructor(module: string, name: string, returnType: WType[],
                parameters: WType[], location?: SourceLocation) {
        super(location);
        this.module = module;
        this.name = name;
        this.type = new WFunctionType(returnType, parameters, this.location);
        this.signatureId = 0;
    }

    public emit(e: Emitter): void {
        e.writeUtf8String(this.module);
        e.writeUtf8String(this.name);
        e.writeByte(0x00);
        e.writeUint32(this.signatureId);
        e.setFuncIdx(this.name, this.type);
    }

    public length(e: Emitter): number {
        return getUtf8StringLength(this.module) +
            getUtf8StringLength(this.name) +
            getLeb128UintLength(this.signatureId) + 1;
    }

}

export class WImportSection extends WNode {
    public functions: WImportFunction[];

    constructor(functions: WImportFunction[], location?: SourceLocation) {
        super(location);
        this.functions = functions;
    }

    public emit(e: Emitter): void {
        e.writeByte(SectionCode.import);
        e.writeByte(this.getBodyLength(e));
        e.writeUint32(this.functions.length);
        this.functions.map((func) => func.emit(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
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

    public length(e: Emitter): number {
        return getUtf8StringLength(this.name) +
            getLeb128UintLength(e.getFuncIdx(this.name)) + 1;
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
        e.writeByte(this.getBodyLength(e));
        e.writeUint32(this.functions.length);
        this.functions.map((func) => func.emit(e));
    }

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.functions.length) +
            getArrayLength(this.functions, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
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

    public length(e: Emitter): number {
        return 3 + this.init.length(e);
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

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.globals.length) +
            getArrayLength(this.globals, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }
}

export class WDataSegment extends WNode {
    public memIdx: number;
    public offset: WExpression;
    public dataBuffer: ArrayBuffer;

    constructor(offset: number, dataBuffer: ArrayBuffer, location?: SourceLocation) {
        super(location);
        this.memIdx = 0;
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

    public length(e: Emitter): number {
        return 1 + getLeb128UintLength(this.memIdx) +
            this.offset.length(e) + this.dataBuffer.byteLength +
            getLeb128UintLength(this.dataBuffer.byteLength);
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

    public getBodyLength(e: Emitter): number {
        return getLeb128UintLength(this.segments.length) +
            getArrayLength(this.segments, (x) => x.length(e));
    }

    public length(e: Emitter): number {
        return getLeb128UintLength(this.getBodyLength(e)) +
            this.getBodyLength(e) + 1;
    }
}

export interface WModuleConfig {
    functions: WFunction[];
    imports: WImportFunction[];
    exports: string[];
    globals: WGlobalVariable[];
    data: WDataSegment[];
}

export class WModule extends WNode {
    public functions: WFunction[];
    public imports: WImportFunction[];
    public exports: string[];
    public globals: WGlobalVariable[];
    public data: WDataSegment[];

    constructor(config: WModuleConfig, location?: SourceLocation) {
        super(location);
        this.functions = config.functions;
        this.imports = config.imports;
        this.exports = config.exports;
        this.globals = config.globals;
        this.data = config.data;
    }

    public emit(e: Emitter): void {
        e.writeBytes([0x00, 0x61, 0x73, 0x6D]);
        e.writeBytes([0x01, 0x00, 0x00, 0x00]);
        const {
            typeSection,
            importSection,
            functionSection,
            memorySection,
            globalSection,
            exportSection,
            codeSection,
            dataSection,
        } = this.generateSections();
        typeSection.emit(e);
        importSection.emit(e);
        functionSection.emit(e);
        memorySection.emit(e);
        globalSection.emit(e);
        exportSection.emit(e);
        codeSection.emit(e);
        dataSection.emit(e);
    }

    public length(e: Emitter): number {
        return 0;
    }

    private generateSections() {
        const funcTypes: WFunctionType[] = [];
        for (const func of [...this.functions, ...this.imports]) {
            func.signatureId = funcTypes.length;
            funcTypes.push(func.type);
        }

        const exports = this.exports.map((x) => new WExportFunction(x, this.location));

        const globalSection = new WGlobalSection(this.globals, this.location);
        const importSection = new WImportSection(this.imports, this.location);
        const memorySection = new WMemorySection([[2, null]], this.location);
        const functionSection = new WFunctionSection(this.functions, this.location);
        const typeSection = new WTypeSection(funcTypes, this.location);
        const codeSection = new WCodeSection(this.functions, this.location);
        const exportSection = new WExportSection(exports, this.location);
        const dataSection = new WDataSection(this.data, this.location);

        return {
            typeSection,
            importSection,
            functionSection,
            memorySection,
            globalSection,
            exportSection,
            codeSection,
            dataSection,
        };
    }

}
