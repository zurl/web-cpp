import * as PegJs from 'pegjs';
import {SourceMapConsumer, SourceMapGenerator, SourceNode} from 'source-map';
import {getFileNameForPhase} from '.';

const trigraghSequenceReplacements = {
    '??=': '#',
    '??(': '[',
    '??/': '\\',
    '??)': ']',
    '??\'': '^',
    '??<': '{',
    '??!': '|',
    '??>': '}',
    '??-': '~'
};

const backslashNewLineReplacements = {
    '\\\n': '',
    '\\\r\n': ''
};

export interface PreprocessedSource {
    code: string;
    map: SourceMapGenerator;
}

function process(fileName: string, source: string): PreprocessedSource {

    // 1. Physical source file multibyte characters are mapped, in an implementation-defined manner, to the source
    // character set (introducing new-line characters for end-of-line indicators) if necessary. Trigraph sequences
    // are replaced by corresponding single-character internal representations.
    const {code: phase1Code, map: phase1Map} = replaceWithSourceMap(fileName, source, trigraghSequenceReplacements,
        getFileNameForPhase(fileName, 1));

    // 2. Each instance of a backslash character (\) immediately followed by a new-line character is deleted,
    // splicing physical source lines to form logical source lines. Only the last backslash on any physical source
    // line shall be eligible for being part of such a splice.
    const {code: phase2Code, map: phase2Map} = replaceWithSourceMap(getFileNameForPhase(fileName, 1), phase1Code,
        backslashNewLineReplacements, getFileNameForPhase(fileName, 2));
    phase2Map.applySourceMap(new SourceMapConsumer(phase1Map.toString()));

    // A source file that is not empty shall end in a new-line character, which shall not be immediately preceded by a
    // backslash character before any such splicing takes place.
    // But in real world, and in ISO/IEC JTC1 SC22 WG21 N3690 (C11):
    // A source file that is not empty and that does not end in a new-line character, or that ends in a new-line
    // character immediately preceded by a backslash character before any such splicing takes place, shall be processed
    // as if an additional new-line character were appended to the file.
    // TODO: Emit a warning here?
    let code = phase2Code;

    return {
        code,
        map: phase2Map
    };
}

const replacementsParserCache = new Map();

/**
 * @param {string} sourceFileName
 * @param {string} source
 * @param {Object} replacements
 * @param {string} generatedFileName
 * @return {{ code: string, map: SourceMapGenerator }}
 */
function replaceWithSourceMap(sourceFileName: string, source: string, replacements: any, generatedFileName: string): PreprocessedSource {

    let parser = replacementsParserCache.get(replacements);
    if (!parser) {
        const grammar =
            `Start
    = nodes:Node*

Node
    = Replacement
    / !Replacement [^] {
        const start = location().start;
        return {
            line: start.line,
            column: start.column - 1,
            source: text()
        };
    }

Replacement
    = ${Object.keys(replacements).map(text => `${JSON.stringify(text)} {
        const start = location().start;
        return {
            line: start.line,
            column: start.column - 1,
            source: ${balanceCurlyBraces(JSON.stringify(replacements[text]))}
        };
    }`).join(`
    / `)}
`;
        parser = PegJs.generate(grammar);
        replacementsParserCache.set(replacements, parser);
    }

    const nodes = parser.parse(source).map((node: any)=>
    new SourceNode(node.line, node.column, sourceFileName, node.source)
)
    ;
    const rootNode = new SourceNode(1, 0, sourceFileName, nodes);
    return rootNode.toStringWithSourceMap({file: generatedFileName});
}
function balanceCurlyBraces(string: string): string {
    if (string.includes('{')) {
        return string + '/*}*/'
    } else if (string.includes('}')) {
        return '/*{*/' + string;
    } else {
        return string;
    }
}

export default {
    process
};
