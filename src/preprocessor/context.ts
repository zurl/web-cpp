/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 08/07/2018
 */
import {SourceMapGenerator, SourceNode} from "source-map";
import {PreprocessError} from "../common/error";
import {parseMarco} from "./index";

export interface Marco {
    name: string;
    parameters: string[] | null;
    target: string;
    parsedTarget: Array<string | number>;
}

export interface Position {
    line: number;
    column: number;
}

export enum PreprocessStatus {
    ON_IF,
    ON_ELSE,
}

export class PreprocessContext {
    public node: SourceNode;
    public sourceFileName: string;
    public generatedFileName: string;
    public marcoMap: Map<string, Marco>;
    public skipBlock: boolean;
    public status: Array<[PreprocessStatus, boolean]>;
    public targetLine: number;
    public targetColumn: number;
    public onMultiLineComment: boolean;

    constructor(fileName: string, marcoMap: Map<string, Marco>) {
        this.sourceFileName = fileName;
        this.generatedFileName = fileName.replace(".cpp", ".ii");
        this.node = new SourceNode(1, 0, this.generatedFileName);
        this.marcoMap = marcoMap;
        this.skipBlock = false;
        this.status = [];
        this.targetLine = 0;
        this.targetColumn = 0;
        this.onMultiLineComment = false;
    }

    public defineMarco(name: string, parameters: string[] | null, target: string) {
        target = target.trim();
        if (this.marcoMap.has(name)) {
            throw new PreprocessError(`marco ${name} is already defined`);
        }
        if (parameters === null) {
            const parsedTarget = parseMarco([], target);
            this.marcoMap.set(name, {name, parameters, target, parsedTarget});
        } else {
            const parsedTarget = parseMarco(parameters, target);
            this.marcoMap.set(name, {name, parameters, target, parsedTarget});
        }

    }

    public undefineMarco(name: string) {
        if (!this.marcoMap.has(name)) {
            throw new PreprocessError(`marco ${name} is not defined`);
        }
        this.marcoMap.delete(name);
    }

    public append(str: string, sourceStartPosition: Position) {
        this.node.add(new SourceNode(
            sourceStartPosition.line + 1,
            sourceStartPosition.column,
            this.sourceFileName, str));
    }
}
