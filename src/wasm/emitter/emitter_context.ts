import {SourceMapConsumer} from "source-map";
import {WFunctionType} from "..";
import {EmitError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {SourceMap} from "../../common/object";
import {WFunction} from "../section/wfunction";
import {WType} from "../tool/constant";

export interface FunctionInfo {
    id: number;
    type: WFunctionType;
}

export interface GlobalInfo {
    id: number;
    type: WType;
}

export class EmitterContext {

    public funcTypeEncodingMap: Map<string, number>;
    public functionMap: Map<string, FunctionInfo>;
    public globalMap: Map<string, GlobalInfo>;
    public functionIdNow: number;
    public globalIdNow: number;
    public currentFunction: WFunction | null;
    public externMap: Map<string, number>;
    public sourceMap: Map<string, SourceMap>;
    public sourceMapConsumer: SourceMapConsumer | null;

    constructor(externMap: Map<string, number>, sourceMap: Map<string, SourceMap>) {
        this.functionMap = new Map<string, FunctionInfo>();
        this.globalMap = new Map<string, GlobalInfo>();
        this.funcTypeEncodingMap = new Map<string, number>();
        this.functionIdNow = 0;
        this.globalIdNow = 0;
        this.currentFunction = null;
        this.externMap = externMap;
        this.sourceMap = sourceMap;
        this.sourceMapConsumer = null;
    }

    public getStartLine(location: SourceLocation): number {
        if (this.sourceMapConsumer && location.start.line >= 1) {
            return this.sourceMapConsumer.originalPositionFor(location.start).line;
        }
        return -1;
    }

    public getEndLine(location: SourceLocation): number {
        if (this.sourceMapConsumer && location.end.line >= 1) {
            return this.sourceMapConsumer.originalPositionFor(location.end).line;
        }
        return -1;
    }

    public setSourceMap(fileName: string) {
        if (fileName && this.sourceMap && this.sourceMap.get(fileName)) {
            this.sourceMapConsumer = new SourceMapConsumer(this.sourceMap.get(fileName)!.sourceMap.toString());
        } else {
            this.sourceMapConsumer = null;
        }
    }

    public getFuncInfo(name: string): FunctionInfo {
        const info = this.functionMap.get(name);
        if (!info) {
            throw new EmitError(`undefined function ${name}`);
        }
        return info;
    }

    public submitFunc(name: string, type: WFunctionType): number {
        if (this.functionMap.has(name)) {
            throw new EmitError(`duplicated name ${name}`);
        }
        this.functionMap.set(name, {
            id: this.functionIdNow,
            type,
        });
        return this.functionIdNow++;
    }

    public getGlobalInfo(name: string): GlobalInfo {
        const info = this.globalMap.get(name);
        if (!info) {
            throw new EmitError(`undefined name ${name}`);
        }
        return info;
    }

    public submitGlobal(name: string, type: WType): number {
        if (this.globalMap.has(name)) {
            throw new EmitError(`duplicated name ${name}`);
        }
        this.globalMap.set(name, {
            id: this.globalIdNow,
            type,
        });
        return this.globalIdNow++;
    }

    public setCurrentFunc(func: WFunction | null) {
        this.currentFunction = func;
        this.sourceMapConsumer = null;
        if (func !== null) {
            const sourceMap = this.sourceMap.get(func.fileName);
            if (sourceMap) {
                this.sourceMapConsumer = new SourceMapConsumer(sourceMap.sourceMap.toString());
            }
        }
    }

    public getCurrentFunc(): WFunction {
        if (!this.currentFunction) {
            throw new EmitError(`not in func`);
        }
        return this.currentFunction;
    }

    public getExternLocation(name: string): number {
        const item = this.externMap.get(name);
        if (!item) {
            throw new EmitError(`unresolve symbol ${name}`);
        }
        return item;
    }

    public getTypeIdxFromEncoding(encoding: string): number {
        const item = this.funcTypeEncodingMap.get(encoding);
        if (!item) {
            throw new EmitError(`unresolve type ${encoding}`);
        }
        return item;
    }

    public setTypeIdxFromEncoding(encoding: string, idx: number): void {
        this.funcTypeEncodingMap.set(encoding, idx);
    }

}
