import {SourceLocation} from "../common/node";
import {Emitter} from "./emitter/emitter";
import {WNode} from "./node";
import {WCodeSection} from "./section/wcode_section";
import {WDataSection} from "./section/wdata_section";
import {WDataSegment} from "./section/wdata_segment";
import {WElementSection} from "./section/welement_section";
import {WExportFunction} from "./section/wexport_function";
import {WExportSection} from "./section/wexport_section";
import {WFunction} from "./section/wfunction";
import {WFunctionSection} from "./section/wfunction_section";
import {WFunctionType} from "./section/wfunction_type";
import {WGlobalSection} from "./section/wglobal_section";
import {WGlobalVariable} from "./section/wglobal_variable";
import {WImportFunction} from "./section/wimport_function";
import {WImportItem} from "./section/wimport_item";
import {WImportSection} from "./section/wimport_section";
import {WMemorySection} from "./section/wmemory_section";
import {WTable} from "./section/wtable";
import {WTableSection} from "./section/wtable_section";
import {WTypeSection} from "./section/wtype_section";

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

    constructor(config: WModuleConfig, location: SourceLocation) {
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

    public optimize(e: Emitter): void {
        this.codeSection.optimize(e);
    }
}
