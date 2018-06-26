/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {Node, SourceLocation} from './ast';
import {Type} from "./type";
import {PEG, PegjsError} from "pegjs";
import LocationRange = PEG.LocationRange;

export class FatalError extends Error {
}

export class InternalError extends Error {
}

export class LinkerError extends Error {
}


export class CompilerError extends Error {
    name: string;
    node: Node;
    location: SourceLocation;

    constructor(message: string, node: Node) {
        super(message);
        this.name = this.constructor.name;
        this.node = node;
        this.location = node.location;
    }
}

export class TypeError extends CompilerError {
}

export class SyntaxError extends CompilerError {
}

export class PreprocessingError extends CompilerError {
}

export class ParserError extends Error {
    pegError: PegjsError;
    name: string;
    location: SourceLocation;

    constructor(pegError: PegjsError) {
        super(pegError.message);
        this.pegError = pegError;
        this.name = pegError.name;
        this.location = pegError.location as any;
    }
}


export function assertType<T extends Node>(object: Node | Node[], type: { new(...args: any[]): T }) {
    if (object instanceof Array) {
        if (object.length == 0) {
            throw new FatalError(`the node expect to be ${type.prototype.constructor.name}`
                + `, but actual is a empty array.`);
        }
        else {
            throw new SyntaxError(`the node expect to be ${type.prototype.constructor.name}`
                + `, but actual is a array of ${object[0].constructor.name}.`, object[0]);
        }
    }
    if (!(object instanceof type)) {
        throw new SyntaxError(`the node expect to be ${type.prototype.constructor.name}`
            + `, but actual is ${object.constructor.name}.`
            , object)
    }
}