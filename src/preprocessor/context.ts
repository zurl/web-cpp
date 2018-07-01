/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 26/06/2018
 */
import {FunctionLikeDefineDirective, ObjectLikeDefineDirective} from "../common/ast";
import {PreprocessingError} from "../common/error";

type Marcos = ObjectLikeDefineDirective|FunctionLikeDefineDirective;

export class PreprocessingContext {

    public fileName: string;
    public source: string;
    public parent?: PreprocessingContext;
    public macros: Map<string, Marcos>;
    public macroNamesBeingReplaced: Set<string>;

    constructor(fileName: string, source: string, parent?: PreprocessingContext) {
        this.fileName = fileName!;
        this.source = source!;
        this.parent = parent;
        this.macros = new Map<string, Marcos>();
        this.macroNamesBeingReplaced = new Set<string>();
    }

    public getFileName(): string {
        if (this.fileName) {
            return this.fileName;
        }
        if (this.parent) {
            return this.parent.getFileName();
        }
        return "";
    }

    public getSource(): string {
        if (this.source) {
            return this.source;
        }
        if (this.parent) {
            return this.parent.getSource();
        }
        return "";
    }

    public defineMacro(macro: Marcos) {

        if (this.parent) {
            this.parent.defineMacro(macro);
        }

        const definedMacro = this.findMacro(macro.name.name);
        if (definedMacro) {
            if (!this.isMacroIdentical(definedMacro, macro)) {
                throw new PreprocessingError(`Macro ${definedMacro.name.name} redefined`, macro.name);
            }
        } else {
            this.macros.set(macro.name.name, macro);
        }
    }

    public isMacroIdentical(macro1: Marcos, macro2: Marcos) {
        // Two replacement lists are identical if and only if the preprocessing tokens in both have the same number,
        // ordering, spelling, and white-space separation, where all white-space separations are considered identical.
        // FIXME: The Punctuator-Identifier case.
        return macro1.name === macro2.name;
    }

    public undefineMacro(name: string): boolean {

        if (this.parent) {
            return this.parent.undefineMacro(name);
        }

        return this.macros.delete(name);
    }

    public findMacro(name: string): Marcos {
        if (this.parent) {
            return this.parent.findMacro(name);
        }
        return this.macros.get(name)!;
    }

    public isMacroDefined(name: string): boolean {
        return !!this.findMacro(name);
    }

    public isMacroBeingReplaced(name: string ): boolean {
        if (this.macroNamesBeingReplaced.has(name)) {
            return true;
        }
        if (this.parent) {
            return this.parent.isMacroBeingReplaced(name);
        }
        return false;
    }

    public markMacroAsBeingReplaced(name: string) {
        this.macroNamesBeingReplaced.add(name);
    }

    public newChildContext() {
        return new PreprocessingContext(this.fileName, this.source, this);
    }
}
