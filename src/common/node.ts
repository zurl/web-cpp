import {CompileContext} from "../codegen/context";
import {ClassType} from "../type/class_type";

export class Position {
    public offset: number;
    public line: number;
    public column: number;

    constructor(offset: number, line: number, column: number) {
        this.offset = offset;
        this.line = line;
        this.column = column;
    }

    public toString() {
        return `(${this.line}:${this.column})`;
    }
}

export class SourceLocation {
    public fileName: string;
    public source: string;
    public start: Position;
    public end: Position;

    constructor(fileName: string, source: string, start: Position, end: Position) {
        this.fileName = fileName;
        this.source = source;
        this.start = start;
        this.end = end;
    }

    public toString() {
        return `${this.start.line}(${this.start.column}) - ${this.end.line}(${this.end.column})`;
    }
}

export const EmptyLocation = new SourceLocation("", "",
    new Position(1, -1, 1),
    new Position(1, -1, 1),
);

export abstract class Node {

    public static getEmptyLocation() {
        return EmptyLocation;
    }
    public location: SourceLocation;

    protected constructor(location: SourceLocation) {
        this.location = location;
    }

}

export abstract class Directive extends Node {

    constructor(location: SourceLocation) {
        super(location);
    }
    public abstract codegen(ctx: CompileContext): void;
}

export abstract class ClassDirective extends Directive {

    constructor(location: SourceLocation) {
        super(location);
    }

    public abstract declare(ctx: CompileContext, classType: ClassType): void;
}
