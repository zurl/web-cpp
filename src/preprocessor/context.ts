import {PreprocessingError} from "../common/error";
import {FunctionLikeDefineDirective, ObjectLikeDefineDirective} from "../common/ast";

/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 26/06/2018
 */

type Marcos = ObjectLikeDefineDirective|FunctionLikeDefineDirective;

export class PreprocessingContext {

    _fileName: string;
    _source: string;
    _parent?: PreprocessingContext;
    _macros: Map<string, Marcos>;
    _macroNamesBeingReplaced: Set<string>;

    constructor(fileName?: string, source?: string, parent?: PreprocessingContext) {
        this._fileName = fileName!;
        this._source = source!;
        this._parent = parent;
        this._macros = new Map<string, Marcos>();
        this._macroNamesBeingReplaced = new Set<string>();
    }

    getFileName(): string | null {
        if (this._fileName) {
            return this._fileName;
        }
        if (this._parent) {
            return this._parent.getFileName();
        }
        return null;
    }

    getSource(): string | null{
        if (this._source) {
            return this._source;
        }
        if (this._parent) {
            return this._parent.getSource();
        }
        return null;
    }

    defineMacro(macro: Marcos) {

        if (this._parent) {
            this._parent.defineMacro(macro);
        }

        const definedMacro = this.findMacro(macro.name.name);
        if (definedMacro) {
            if (!this.isMacroIdentical(definedMacro, macro)) {
                throw new PreprocessingError(`Macro ${definedMacro.name.name} redefined`, macro.name);
            }
        } else {
            this._macros.set(macro.name.name, macro);
        }
    }

    isMacroIdentical(macro1: Marcos, macro2: Marcos) {
        // Two replacement lists are identical if and only if the preprocessing tokens in both have the same number,
        // ordering, spelling, and white-space separation, where all white-space separations are considered identical.
        // FIXME: The Punctuator-Identifier case.
        return macro1.name == macro2.name;
    }

    undefineMacro(name: string): boolean {

        if (this._parent) {
            return this._parent.undefineMacro(name);
        }

        return this._macros.delete(name);
    }

    findMacro(name: string): Marcos {
        if (this._parent) {
            return this._parent.findMacro(name);
        }
        return this._macros.get(name)!;
    }

    isMacroDefined(name: string): boolean {
        return !!this.findMacro(name);
    }

    isMacroBeingReplaced(name:string ):boolean {
        if (this._macroNamesBeingReplaced.has(name)) {
            return true;
        }
        if (this._parent) {
            return this._parent.isMacroBeingReplaced(name);
        }
        return false;
    }

    markMacroAsBeingReplaced(name: string) {
        this._macroNamesBeingReplaced.add(name);
    }

    newChildContext(fileName: string, source: string) {
        return new PreprocessingContext(fileName, source, this);
    }
}