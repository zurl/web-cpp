/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */

import {Node, Position, SourceLocation} from "./Node";

export class FatalError extends Error {
}

export class InternalError extends Error {
}

export class LinkerError extends Error {
}

export class RuntimeError extends Error {
}

export class EmitError extends Error {
}

export class CompilerError extends Error {
    public name: string;
    public node: Node;
    public location: SourceLocation;
    public errorLine: string;
    constructor(message: string, node: Node) {
        super(message);
        this.name = this.constructor.name;
        this.node = node;
        if ( node ) {
            this.location = node.location;
        }  else {
            this.location = new SourceLocation(
                "", "",
                new Position(0, 0, 0),
                new Position(0, 0, 0),
            );
        }
        this.errorLine = "";
    }

    public toString() {
        return `${this.name}: ${this.message} at ${this.location.start.line}:${this.location.start.column}`;
    }
}

export class TypeError extends CompilerError {
}

export class SyntaxError extends CompilerError {
}

export class LanguageError extends CompilerError {
}

export class PreprocessingError extends CompilerError {
}

export class PreprocessError extends Error {
}

export function assertType<T extends Node>(object: Node | Node[], type: { new(...args: any[]): T }) {
    if (object instanceof Array) {
        if (object.length === 0) {
            throw new FatalError(`the node expect to be ${type.prototype.constructor.name}`
                + `, but actual is a empty array.`);
        } else {
            throw new SyntaxError(`the node expect to be ${type.prototype.constructor.name}`
                + `, but actual is a array of ${object[0].constructor.name}.`, object[0]);
        }
    }
    if (!(object instanceof type)) {
        throw new SyntaxError(`the node expect to be ${type.prototype.constructor.name}`
            + `, but actual is ${object.constructor.name}.`
            , object);
    }
}
