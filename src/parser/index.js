'use strict';
import PegJs from 'pegjs'
import CGrammar from './c.lang';
import CPPGrammar from './c.lang';
import * as fs from 'fs';
import Long_ from 'long';
import * as CTree_ from '../common/ast';
import {TypeError} from "../common/error"
import {Node} from '../common/ast';

const storageClassSpecifierStringToEnum = [
    'typedef', 'extern', 'static', '_Thread_local', 'auto', 'register'
];

export function getStorageClassSpecifierFromSpecifiers(specifiers, nodeForError) {

    const storageClassSpecifiers = [];
    for (const specifier of specifiers) {
        if (storageClassSpecifierStringToEnum.includes(specifier)) {
            storageClassSpecifiers.push(specifier);
        }
    }

    // At most, one storage-class specifier may be given in the declaration specifiers in a declaration, except that
    // _Thread_local may appear with static or extern.
    if (!(storageClassSpecifiers.length < 2 || (storageClassSpecifiers.length === 2
        && storageClassSpecifiers.includes('_Thread_local')
        && (storageClassSpecifiers.includes('static')
            || storageClassSpecifiers.includes('extern'))))) {
        throw new TypeError('Multiple storage classes in declaration specifiers', nodeForError);
    }
    // _Thread_local shall not appear in the declaration specifiers of a function declaration.
    // TODO

    if (storageClassSpecifiers.includes('_Thread_local')) {
        throw new TypeError(`Unsupported: '_Thread_local' is not supported`,
            nodeForError);
    }
    if (storageClassSpecifiers.includes('register')) {
        throw new TypeError(`Unsupported: 'register' is not supported`,
            nodeForError);
    }

    return storageClassSpecifiers[0] || null;
}
const Ty_ = {
    getStorageClassSpecifierFromSpecifiers
};

function loadParser(source, query) {
    /** Inject into eval **/
    const Long = Long_;
    const Ty = Ty_;
    const AST = CTree_;

    // cache
    if(global['window'] === undefined && fs.existsSync('/tmp/' + query.parserName + '.js')){
        const code = fs.readFileSync('/tmp/' + query.parserName + '.js', 'utf8');
        const ret = eval(code);
        return ret;
    }
    source = source.replace(/&!'((\\.|[^'])*)'/g, (match, rule) => `(expected:'${rule}'? {
        if (!expected) {${rule.includes('}') ? '/*{*/' : ''}
            error('Missing \\\'${rule}\\\'');
        }
        return expected;
    })`);
    query.output = 'source';
    query.cache = !!query.cache;
    query.optimize = query.optimize || 'speed';
    query.trace = !!query.trace;
    if (typeof query.allowedStartRules === 'string') {
        query.allowedStartRules = [query.allowedStartRules];
    }
    const code = PegJs.generate(source, query);
    if(global['window'] === undefined) {
        console.log('fuck');
        fs.writeFileSync('/tmp/' + query.parserName + '.js', code);
    }
    return eval(code);
}

const ConstantExpressionPegParser = loadParser(CGrammar, {parserName: 'ConstantExpression', allowedStartRules: 'ConstantExpression'});
const HeaderNamePegParser = loadParser(CGrammar, {parserName: 'HeaderName',allowedStartRules: 'HeaderName'});
const PreprocessingFilePegParser= loadParser(CGrammar, {parserName: 'PreprocessingFile',allowedStartRules: 'PreprocessingFile'});
const PreprocessingTokenPegParser= loadParser(CGrammar, {parserName: 'PreprocessingToken',allowedStartRules: 'PreprocessingToken'});
const TranslationUnitPegParser= loadParser(CGrammar, {parserName: 'TranslationUnitPegParser'});
const CPPTranslationUnitPegParser= loadParser(CPPGrammar, {parserName: 'CPPTranslationUnitPegParser'});

function setParentNodeForAST(ctree) {
    let queue = [];
    queue.push(ctree);
    while (queue.length > 0) {
        let node = queue.pop();
        for (let name in node) {
            if (name === 'parentNode') {
                continue;
            }
            let prop = node[name];
            if (prop instanceof Node) {
                prop.parentNode = node;
                queue.push(prop);
            } else if (prop instanceof Array) {
                for (let elm of prop) {
                    if (elm instanceof Node) {
                        elm.parentNode = node;
                        queue.push(elm);
                    }
                }
            }
        }
    }
}

/**
 * @constructor
 * @param {peg$SyntaxError} pegError
 */
export function ParserError(pegError) {

    Error.call(this);
    Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);

    
}
ParserError.prototype = Object.create(Error.prototype);
ParserError.prototype.constructor = ParserError;

function wrapPegParser(parser) {
    return {
        parse(source, options) {
            try {
                let r = parser.parse(source, options);
                setParentNodeForAST(r, null);
                return r;
            } catch (e) {
                if (e instanceof parser.SyntaxError) {
                    throw new ParserError(e);
                } else {
                    throw e;
                }
            }
        }
    };
}

export const ConstantExpressionParser = wrapPegParser(ConstantExpressionPegParser);
export const HeaderNameParser = wrapPegParser(HeaderNamePegParser);
export const PreprocessingFileParser = wrapPegParser(PreprocessingFilePegParser);
export const PreprocessingTokenParser = wrapPegParser(PreprocessingTokenPegParser);

export const CParser = wrapPegParser(TranslationUnitPegParser);
export const CPPParser = wrapPegParser(CPPTranslationUnitPegParser);