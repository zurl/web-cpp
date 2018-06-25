'use strict';

import { SourceMapConsumer } from 'source-map';

import { ParserError } from '../parser';


/**
 * @param {string} fileName
 * @param {string} extensionOrExpectedExtension
 * @param {string?} extension
 */
export function replaceFileNameExtension(fileName, extensionOrExpectedExtension, extension) {
    let expectedExtension;
    if (typeof extension === 'undefined') {
        extension = extensionOrExpectedExtension;
        expectedExtension = null;
    } else {
        expectedExtension = extensionOrExpectedExtension;
    }
    const indexOfDot = fileName.lastIndexOf('.');
    if (expectedExtension !== null && fileName.substring(indexOfDot) !== expectedExtension) {
        return fileName + extension;
    }
    return (indexOfDot >= 0 ? fileName.substring(0, indexOfDot) : fileName) + extension;
}


/**
 * @param {SourceLocation|{ start: { offset: int, line: int, column: int}, end: { offset: int, line: int, column: int} }} location
 * @param {string} source
 * @param {string} map
 */

export function transformSourceLocationWithSourceMap(location, source, map) {
    const mapConsumer = new SourceMapConsumer(map);
    let { line: startLine, column: startColumn } = mapConsumer.originalPositionFor({
        line: location.start.line,
        column: location.start.column
    });
    let { line: endLine, column: endColumn } = mapConsumer.originalPositionFor({
        line: location.end.line,
        column: location.end.column
    });
    if (endLine == null || endColumn == null) {
        endLine = startLine;
        endColumn = startColumn;
    }
    let offset = 0;
    const sourceLines = source.split('\n');
    for (let line = 1; line <= endLine; ++line) {
        // Line is 1-based, column is 0-based, and this is source map.
        const sourceLine = sourceLines[line - 1];
        if (line === startLine) {
            location.start.offset = offset + startColumn;
            location.start.line = startLine;
            location.start.column = startColumn;
        }
        if (line === endLine) {
            location.end.offset = offset + endColumn;
            location.end.line = endLine;
            location.end.column = endColumn;
        }
        offset += sourceLine.length + 1;
    }
}



import phase12 from './phase12';
import phase34, { PreprocessingError } from './phase34';

/**
 * @param {string} fileName
 * @param {string} source
 * @param {PreprocessingContext?} context
 * @return {{ code: string, map: string }}
 */
function process(fileName, source, context = null) {
    const { code: phase12Code, map: phase12MapGenerator } = phase12.process(fileName, source);
    const phase12Map = phase12MapGenerator.toString();
    let phase34Code, phase34MapGenerator;
    try {
        ({ code: phase34Code, map: phase34MapGenerator } = phase34.process(fileName, phase12Code, context));
    } catch (e) {
        if (e instanceof ParserError || e instanceof PreprocessingError) {
            if (e instanceof ParserError) {
                e.location.start.column--;
                e.location.end.column--;
            }
            transformSourceLocationWithSourceMap(e.location, phase12Code, phase12Map);
        }
        throw e;
    }
    phase34MapGenerator.applySourceMap(new SourceMapConsumer(phase12Map));
    const phase34Map = phase34MapGenerator.toString();
    return { code: phase34Code, map: phase34Map };
}

/**
 * @param {string} fileName
 * @param {int} phase
 * @return {string}
 */
export function getFileNameForPhase(fileName, phase) {
    if (phase === 4) {
        return replaceFileNameExtension(fileName, '.c', '.ii');
    }
    return `${fileName}<phase${phase}>`;
}

export default {
    process
};
