//@ts-check
'use strict';

import {SourceMapGenerator, SourceNode} from 'source-map';

const Library = {};
import {
    ConstantExpressionParser, HeaderNameParser, PreprocessingFileParser, PreprocessingTokenParser
} from '../parser';

import Preprocessor from '.';
import { getFileNameForPhase } from '.';
import Long from 'long';

import {
    BinaryExpression, CharacterConstant, ConditionalExpression, Directive, ElifGroup, ElseGroup, ErrorDirective,
    FunctionLikeDefineDirective, Identifier, IfGroup, IfSection, IfdefGroup, IfndefGroup, IncludeDirective,
    IntegerConstant, LineDirective, Node, NonDirective, NullDirective, ObjectLikeDefineDirective, ParenthesisExpression,
    PpChar, PpNumber, PragmaDirective, PreprocessingFile, Punctuator, SourceLocation, StringLiteral, TextBlock,
    UnaryExpression, UndefDirective
} from '../common/ast';
function SyntaxError(message, node) {
    Error.call(this);
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
    this.message = message;
    this.node = node;
    this.location = node.location;
}
SyntaxError.prototype = Object.create(Error.prototype);
SyntaxError.prototype.constructor = SyntaxError;
export function getIntegerValueFromCharacterConstantValue(constant, errorType = SyntaxError) {
    // An integer character constant has type int. The value of an integer character constant containing a single
    // character that maps to a single-byte execution character is the numerical value of the representation of the
    // mapped character interpreted as an integer. The value of an integer character constant containing more than one
    // character (e.g., 'ab'), or containing a character or escape sequence that does not map to a single-byte execution
    // character, is implementation-defined. If an integer character constant contains a single character or escape
    // sequence, its value is the one that results when an object with type char whose value is that of the single
    // character or escape sequence is converted to type int.
    // FIXME
    // Consider implementations that use two’s complement representation for integers and eight bits for objects that
    // have type char. In an implementation in which type char has the same range of values as signed char, the integer
    // character constant '\xFF' has the value −1; if type char has the same range of values as unsigned char, the
    // character constant '\xFF' has the value +255.
    if (constant.value.length > 1) {
        // UNDEFINED_BEHAVIOR
        throw new errorType(`Multi-character character constant '${constant.value}'`, constant);
    }
    const value = constant.value.charCodeAt(constant.value.length - 1);
    // In fact not possible, but just leave this check here for future.
    // > The charCodeAt() method returns an integer between 0 and 65535 representing the UTF-16 code unit at the given
    // > index.
    if (value > 0x7FFFFFFF) {
        throw new errorType('Character too large for enclosing character literal type', constant);
    }
    return Long.fromInt(value);
}
/**
 * @param {string} fileName
 * @param {string} source
 * @param {PreprocessingContext|null} context
 * @return {{ code: string, map: SourceMapGenerator }}
 */
function process(fileName, source, context) {

    // 3. The source file is decomposed into preprocessing tokens and sequences of white-space characters
    // (including comments). A source file shall not end in a partial preprocessing token or in a partial comment.
    // Each comment is replaced by one space character. New-line characters are retained. Whether each nonempty
    // sequence of white-space characters other than new-line is retained or replaced by one space character is
    // implementation-defined.
    const preprocessingFile = PreprocessingFileParser.parse(source, { preprocessing: true });

    // 4. Preprocessing directives are executed, macro invocations are expanded, and _Pragma unary operator
    // expressions are executed. If a character sequence that matches the syntax of a universal character name is
    // produced by token concatenation (6.10.3.3), the behavior is undefined. A #include preprocessing directive
    // causes the named header or source file to be processed from phase 1 through phase 4, recursively. All
    // preprocessing directives are then deleted.
    const sourceNode = processFile(getFileNameForPhase(fileName, 2), preprocessingFile, context);

    return sourceNode.toStringWithSourceMap({ file: getFileNameForPhase(fileName, 4) });
}

/**
 * @constructor
 * @param {string} message
 * @param {Node} node
 */
export function PreprocessingError(message, node) {

    Error.call(this);
    Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
    this.node = node;
    this.location = node.location;
}
PreprocessingError.prototype = Object.create(Error.prototype);
PreprocessingError.prototype.constructor = PreprocessingError;

class PreprocessingContext {

    /**
     * @param {string|null} fileName
     * @param {string|null} source
     * @param {PreprocessingContext|null} parent
     */
    constructor(fileName = null, source = null, parent = null) {
        this._fileName = fileName;
        this._source = source;
        this._parent = parent;
        this._macros = parent ? null : new Map();
        this._macroNamesBeingReplaced = new Set();
    }

    /**
     * @return {string|null}
     */
    getFileName() {
        if (this._fileName) {
            return this._fileName;
        }
        if (this._parent) {
            return this._parent.getFileName();
        }
        return null;
    }

    /**
     * @return {string|null}
     */
    getSource() {
        if (this._source) {
            return this._source;
        }
        if (this._parent) {
            return this._parent.getSource();
        }
        return null;
    }

    /**
     * @param {ObjectLikeDefineDirective|FunctionLikeDefineDirective} macro
     */
    defineMacro(macro) {

        if (this._parent) {
            return this._parent.defineMacro(macro);
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

    /**
     * @param {ObjectLikeDefineDirective|FunctionLikeDefineDirective} macro1
     * @param {ObjectLikeDefineDirective|FunctionLikeDefineDirective} macro2
     * @return {boolean}
     */
    isMacroIdentical(macro1, macro2) {
        // Two replacement lists are identical if and only if the preprocessing tokens in both have the same number,
        // ordering, spelling, and white-space separation, where all white-space separations are considered identical.
        // FIXME: The Punctuator-Identifier case.
        return macro1.name == macro2.name;
    }

    /**
     * @param {string} name
     * @return {boolean}
     */
    undefineMacro(name) {

        if (this._parent) {
            return this._parent.undefineMacro(name);
        }

        return this._macros.delete(name);
    }

    /**
     * @param {string} name
     * @return {ObjectLikeDefineDirective|FunctionLikeDefineDirective|null}
     */
    findMacro(name) {

        if (this._parent) {
            return this._parent.findMacro(name);
        }

        return this._macros.get(name);
    }

    /**
     * @param {string} name
     * @return {boolean}
     */
    isMacroDefined(name) {
        return !!this.findMacro(name);
    }

    /**
     * @param {string} name
     * @return {boolean}
     */
    isMacroBeingReplaced(name) {
        if (this._macroNamesBeingReplaced.has(name)) {
            return true;
        }
        if (this._parent) {
            return this._parent.isMacroBeingReplaced(name);
        }
        return false;
    }

    /**
     * @param {string} name
     */
    markMacroAsBeingReplaced(name) {
        this._macroNamesBeingReplaced.add(name);
    }

    /**
     * @param {string|null} fileName
     * @param {string|null} source
     * @return {PreprocessingContext}
     */
    newChildContext(fileName = null, source = null) {
        return new PreprocessingContext(fileName, source, this);
    }
}

/**
 * @param {string} fileName
 * @param {PreprocessingFile} preprocessingFile
 * @param {PreprocessingContext|null} context
 * @return {SourceNode}
 */
function processFile(fileName, preprocessingFile, context) {
    context = new PreprocessingContext(fileName, preprocessingFile.location.source, context);
    return getSourceNodeFromNodeBody(preprocessingFile, context);
}

/**
 * @param {PreprocessingFile|IfGroup|IfdefGroup|IfndefGroup|ElifGroup|ElseGroup} node
 * @param {PreprocessingContext} context
 * @return {SourceNode}
 */
function getSourceNodeFromNodeBody(node, context) {
    return getSourceNodeFromNodeWithChildren(node, node.body, context,
        node => processBodyElement(node, context));
}

/**
 * @param {Node} node
 * @param {PreprocessingContext} context
 * @return {SourceNode|null}
 */
function processBodyElement(node, context) {
    if (node instanceof Directive) {
        return processDirective(node, context);
    } else if (node instanceof IfSection) {
        return processIfSection(node, context);
    } else if (node instanceof TextBlock) {
        return processTextBlock(node, context);
    } else {
        throw new PreprocessingError(`Internal: Unknown element of ${node.constructor.name}.body`, node);
    }
}

/**
 * @param {Directive} directive
 * @param {PreprocessingContext} context
 * @return {SourceNode|null}
 */
function processDirective(directive, context) {
    if (directive instanceof IfGroup || directive instanceof IfdefGroup || directive instanceof IfndefGroup) {
        throw new PreprocessingError('Internal: Should have used processIfSectionGroup() instead', directive);
    } else if (directive instanceof IncludeDirective) {
        let headerName = directive.headerName;
        if (!headerName) {
            // A preprocessing directive of the form
            // # include pp-tokens new-line
            // (that does not match one of the two previous forms) is permitted. The preprocessing tokens after include
            // in the directive are processed just as in normal text. (Each identifier currently defined as a macro name
            // is replaced by its replacement list of preprocessing tokens.) The directive resulting after all
            // replacements shall match one of the two previous forms. 170) The method by which a sequence of
            // preprocessing tokens between a < and a > preprocessing token pair or a pair of " characters is combined
            // into a single header name preprocessing token is implementation-defined.
            if (!directive.tokens.length) {
                throw new PreprocessingError('#include expects "FILENAME" or <FILENAME>', directive);
            }
            const tokens = replaceMacroInvocations(directive.tokens, context);
            const directiveForSpacing = cloneNodeWithOffsetForSpacingAsChildren(directive, tokens);
            const source = getCodeFromNodeWithChildren(directiveForSpacing, tokens, context);
            try {
                headerName = HeaderNameParser.parse(source, { preprocessing: true });
                headerName.location.start = tokens[0].location.start;
                headerName.location.end = tokens[tokens.length - 1].location.end;
            } catch (e) {
                // TODO
                e.location.start = tokens[0].location.start;
                e.location.end = tokens[tokens.length - 1].location.end;
                throw e;
            }
        }
        // A preprocessing directive of the form
        // # include <h-char-sequence> new-line
        // searches a sequence of implementation-defined places for a header identified uniquely by the specified
        // sequence between the < and > delimiters, and causes the replacement of that directive by the entire contents
        // of the header. How the places are specified or the header identified is implementation-defined.
        // A preprocessing directive of the form
        // # include "q-char-sequence" new-line
        // causes the replacement of that directive by the entire contents of the source file identified by the
        // specified sequence between the " delimiters. The named source file is searched for in an
        // implementation-defined manner. If this search is not supported, or if the search fails, the directive is
        // reprocessed as if it read
        // # include <h-char-sequence> new-line
        // with the identical contained sequence (including > characters, if any) from the original directive.
        if (Library.files.has(headerName.name)) {
            return new SourceNode(1, 0, headerName.name, Preprocessor.process(headerName.name,
                Library.files.get(headerName.name), context).code);
        } else {
            throw new PreprocessingError(`'${headerName.name}' file not found`, headerName);
        }
    } else if (directive instanceof ObjectLikeDefineDirective || directive instanceof FunctionLikeDefineDirective) {
        // The values of the predefined macros listed in the following subclauses 176) (except for __FILE__ and
        // __LINE__) remain constant throughout the translation unit.
        // None of these macro names, nor the identifier defined, shall be the subject of a #define or a #undef
        // preprocessing directive.
        if (directive.name.name === 'defined') {
            throw new PreprocessingError('"defined" cannot be used as a macro name', directive.name);
        }
        if (directive instanceof FunctionLikeDefineDirective) {
            // Each # preprocessing token in the replacement list for a function-like macro shall be followed by a
            // parameter as the next preprocessing token in the replacement list.
            const parameterNames = new Set(directive.parameters.map(parameter => parameter.name));
            if (directive.variableArguments) {
                parameterNames.add('__VA_ARGS__');
            }
            for (let j = 0; j < directive.replacements.length; ++j) {
                if (isPunctuator(directive.replacements[j], '#')) {
                    if (!(directive.replacements[j + 1] instanceof Identifier
                        && parameterNames.has(directive.replacements[j + 1].name))) {
                        throw new PreprocessingError('\'#\' is not followed by a macro parameter',
                            directive.replacements[j]);
                    }
                }
                if (isPunctuator(directive.replacements[j], '##')) {
                    markTokenAsInReplacementList(directive.replacements[j]);
                }
            }
        }
        if (directive.replacements.length) {
            // A ## preprocessing token shall not occur at the beginning or at the end of a replacement list for either
            // form of macro definition.
            if (isPunctuator(directive.replacements[0], '##')) {
                throw new PreprocessingError('\'##\' cannot appear at start of macro expansion',
                    directive.replacements[0]);
            } else if (isPunctuator(directive.replacements[directive.replacements.length - 1], '##')) {
                throw new PreprocessingError('\'##\' cannot appear at end of macro expansion',
                    directive.replacements[directive.replacements.length - 1]);
            }
        }
        context.defineMacro(directive);
        return null;
    } else if (directive instanceof UndefDirective) {
        // The values of the predefined macros listed in the following subclauses 176) (except for __FILE__ and
        // __LINE__) remain constant throughout the translation unit.
        // None of these macro names, nor the identifier defined, shall be the subject of a #define or a #undef
        // preprocessing directive.
        if (directive.name.name === 'defined') {
            throw new PreprocessingError('"defined" cannot be used as a macro name', directive.name);
        }
        context.undefineMacro(directive.name.name);
        return null;
    } else if (directive instanceof LineDirective) {
        // TODO: Should #line be ignored?
        return null;
    } else if (directive instanceof ErrorDirective) {
        // A preprocessing directive of the form
        // # error pp-tokens opt new-line
        // causes the implementation to produce a diagnostic message that includes the specified sequence of
        // preprocessing tokens.
        const error = directive.location.source.trim();
        throw new PreprocessingError(error, directive);
    } else if (directive instanceof PragmaDirective) {
        // TODO: Should #pragma be ignored?
        return null;
    } else if (directive instanceof NullDirective) {
        return null;
    } else if (directive instanceof NonDirective) {
        throw new PreprocessingError(`Error: Unknown directive '${directive.tokens[0].value}'.`, directive);
    } else {
        throw new PreprocessingError(`Internal: Unknown directive.`, directive);
    }
}

/**
 * @param {IfSection} ifSection
 * @param {PreprocessingContext} context
 * @return {SourceNode|null}
 */
function processIfSection(ifSection, context) {
    for (const group of [ifSection.ifGroup, ...ifSection.elseIfGroups,
    ...(ifSection.elseGroup ? [ifSection.elseGroup] : [])]) {
        const { test, sourceNode } = processIfSectionGroup(group, context);
        if (test) {
            return sourceNode;
        }
    }
    return null;
}

/**
 * @param {IfGroup|IfdefGroup|IfndefGroup|ElifGroup|ElseGroup} group
 * @param {PreprocessingContext} context
 * @return {{ test: boolean, sourceNode: SourceNode|null }}
 */
function processIfSectionGroup(group, context) {
    let test = null;
    if (group instanceof IfGroup || group instanceof ElifGroup) {
        const tokens = replaceMacroInvocations(group.tokens, context, true);
        // If the token defined is generated as a result of this replacement process or use of the defined unary
        // operator does not match one of the two specified forms prior to macro replacement, the behavior is
        // undefined.
        // UNDEFINED_BEHAVIOR: 'defined' generated with replacement will be interpreted. This is consistent with gcc
        // and clang.
        for (let i = 0; i < tokens.length; ++i) {
            if (tokens[i] instanceof Identifier) {
                const replaceWithNumber = (numberSource, length) => {
                    const number = new PpNumber(new SourceLocation(numberSource, tokens[i].location.start,
                        tokens[i + length - 1].location.end), numberSource);
                    tokens.splice(i, length, number);
                };
                if (tokens[i].name === 'defined') {
                    const replaceDefined = (index, length) => {
                        // evaluate to 1 if the identifier is currently defined as a macro name (that is, if it is
                        // predefined or if it has been the subject of a #define preprocessing directive without an
                        // intervening #undef directive with the same subject identifier), 0 if it is not.
                        const numberSource = context.isMacroDefined(tokens[i + index].name) ? '1' : '0';
                        replaceWithNumber(numberSource, length);
                    };
                    if (tokens[i + 1] instanceof Identifier) {
                        // 'defined' Identifier
                        replaceDefined(1, 2);
                    } else if (isPunctuator(tokens[i + 1], '(') && tokens[i + 2] instanceof Identifier
                        && isPunctuator(tokens[i + 3], ')')) {
                        // 'defined' '(' Identifier ')'
                        replaceDefined(2, 4);
                    } else {
                        throw new PreprocessingError('Internal: Operator "defined" should have been checked in' +
                            ' replaceMacroInvocations()', tokens[i]);
                    }
                } else {
                    replaceWithNumber('0', 1);
                }
            }
        }
        const expression = parseConstantExpression(tokens, group.tokens);
        test = longToBoolean(evaluateIntegerConstantExpression(expression));
    } else if (group instanceof IfdefGroup || group instanceof IfndefGroup) {
        // Preprocessing directives of the forms
        // # ifdef identifier new-line group opt
        // # ifndef identifier new-line group opt
        // check whether the identifier is or is not currently defined as a macro name. Their conditions are
        // equivalent to #if defined identifier and #if !defined identifier respectively.
        test = (group instanceof IfndefGroup) ^ context.isMacroDefined(group.test.name);
    } else if (group instanceof ElseGroup) {
        test = true;
    } else {
        throw new PreprocessingError('Internal: Unknown type of IfSection.group', group);
    }
    if (test && group.body.length) {
        const groupForSpacing = cloneNodeWithOffsetForSpacingAsChildren(group, group.body);
        return {
            test,
            sourceNode: getSourceNodeFromNodeBody(groupForSpacing, context),
        };
    } else {
        return {
            test,
            sourceNode: null
        };
    }
}

/**
 * @param {boolean} boolean
 * @return {Long}
 */
function booleanToLong(boolean) {
    return boolean ? Long.ONE : Long.ZERO;
}

/**
 * @param {Long} long
 * @return {boolean}
 */
function longToBoolean(long) {
    return !long.isZero();
}

/**
 * @param {[Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar]} tokens
 * @param {[Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar]} originalTokens
 * @return {Expression}
 */
function parseConstantExpression(tokens, originalTokens) {
    // HACK: Stringify and parse again, since we only need evaluation here.
    const source = tokens.map(token => token.location.source).join(' ');
    try {
        const constantExpression = ConstantExpressionParser.parse(source, { preprocessing: true });
        constantExpression.location.start = originalTokens[0].location.start;
        constantExpression.location.end = originalTokens[originalTokens.length - 1].location.end;
        return constantExpression;
    } catch (e) {
        e.location.start = originalTokens[0].location.start;
        e.location.end = originalTokens[originalTokens.length - 1].location.end;
        throw e;
    }
}

/**
 * @param {Expression} expression
 * @return {Long}
 */
function evaluateIntegerConstantExpression(expression) {
    // The resulting tokens compose the controlling constant expression which is evaluated according to the rules of
    // 6.6. For the purposes of this token conversion and evaluation, all signed integer types and all unsigned integer
    // types act as if they hav e the same representation as, respectively, the types intmax_t and uintmax_t defined in
    // the header <stdint.h>. 167) This includes interpreting character constants, which may involve converting escape
    // sequences into execution character set members. Whether the numeric value for these character constants matches
    // the value obtained when an identical character constant occurs in an expression (other than within a #if or #elif
    // directive) is implementation-defined. 168) Also, whether a single-character character constant may have a
    // negative value is implementation-defined.
    // Using Long as intmax_t and uintmax_t.
    // FIXME: Signed type and unsigned type?
    // FIXME: Operator definition?
    if (expression instanceof ConditionalExpression) {
        if (longToBoolean(evaluateIntegerConstantExpression(expression.test))) {
            return evaluateIntegerConstantExpression(expression.consequent);
        } else {
            return evaluateIntegerConstantExpression(expression.alternate);
        }
    } else if (expression instanceof BinaryExpression) {
        const left = evaluateIntegerConstantExpression(expression.left);
        const right = evaluateIntegerConstantExpression(expression.right);
        switch (expression.operator) {
            case '||':
                return booleanToLong(longToBoolean(left) || longToBoolean(right));
            case '&&':
                return booleanToLong(longToBoolean(left) && longToBoolean(right));
            case '|':
                return left.or(right);
            case '^':
                return left.xor(right);
            case '&':
                return left.and(right);
            case '==':
                return booleanToLong(left.equals(right));
            case '!=':
                return booleanToLong(left.notEquals(right));
            case '<=':
                return booleanToLong(left.lessThanOrEqual(right));
            case '>=':
                return booleanToLong(left.greaterThanOrEqual(right));
            case '<':
                return booleanToLong(left.lessThan(right));
            case '>':
                return booleanToLong(left.greaterThan(right));
            case '<<':
                return left.shiftLeft(right);
            case '>>':
                // TODO: Unsigned?
                return left.shiftRight(right);
            case '+':
                return left.add(right);
            case '-':
                return left.subtract(right);
            case '*':
                return left.multiply(right);
            case '/':
                return left.divide(right);
            case '%':
                // TODO: Behavior?
                return left.modulo(right);
            default:
                throw new PreprocessingError('Internal: Unknown binary operator', expression);
        }
    } else if (expression instanceof UnaryExpression) {
        const operand = evaluateIntegerConstantExpression(expression.operand);
        switch (expression.operator) {
            case '++':
            case '--':
            case '&':
            case '*':
                throw new PreprocessingError(`Unary operator "${expression.operator}" is not valid in preprocessor` +
                    ` expressions`, expression);
            case '+':
                return operand;
            case '-':
                return operand.negate();
            case '~':
                return operand.not();
            case '!':
                return booleanToLong(!longToBoolean(operand));
            default:
                throw new PreprocessingError('Internal: Unknown unary operator', expression);
        }
    } else if (expression instanceof ParenthesisExpression) {
        return evaluateIntegerConstantExpression(expression.expression);
    } else if (expression instanceof IntegerConstant) {
        return expression.value;
    } else if (expression instanceof CharacterConstant) {
        return getIntegerValueFromCharacterConstantValue(expression, PreprocessingError);
    } else {
        throw new PreprocessingError(`Expression type "${expression.type}" is not valid in preprocessor expressions`,
            expression);
    }
}

/**
 * @param {TextBlock} textBlock
 * @param {PreprocessingContext} context
 * @return {SourceNode}
 */
function processTextBlock(textBlock, context) {
    const tokens = replaceMacroInvocations(textBlock.tokens, context);
    return getSourceNodeFromNodeWithChildren(textBlock, tokens, context,
        node => {
            return new SourceNode(node.location.start.line, node.location.start.column, context.getFileName(),
                node.location.source);
        });
}

const placemarkerPpToken = Symbol('PlacemarkerPpToken');

/**
 * @param {[Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar]} tokens
 * @param {PreprocessingContext} context
 * @param {boolean} enableDefined
 * @return {[Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar]}
 */
function replaceMacroInvocationsInPlace(tokens, context, enableDefined = false) {
    for (let i = 0; i < tokens.length; ++i) {
        if (tokens[i] instanceof Identifier) {
            // Prior to evaluation, macro invocations in the list of preprocessing tokens that will become the
            // controlling constant expression are replaced (except for those macro names modified by the defined
            // unary operator), just as in normal text. If the token defined is generated as a result of this
            // replacement process or use of the defined unary operator does not match one of the two specified
            // forms prior to macro replacement, the behavior is undefined.
            if (enableDefined && tokens[i].name === 'defined') {
                if (tokens[i + 1] instanceof Identifier) {
                    // 'defined' Identifier
                    ++i;
                    continue;
                } else if (isPunctuator(tokens[i + 1], '(')) {
                    if (!(tokens[i + 2] instanceof Identifier)) {
                        throw new PreprocessingError('Operator "defined" requires an identifier',
                            tokens[i + 2] || tokens[i + 1]);
                    }
                    if (!isPunctuator(tokens[i + 3], ')')) {
                        throw new PreprocessingError('missing \')\' after "defined"', tokens[i + 3] || tokens[i + 2]);
                    }
                    // 'defined' '(' Identifier ')'
                    i += 3;
                    continue;
                } else {
                    throw new PreprocessingError('Operator "defined" requires an identifier',
                        tokens[i + 1] || tokens[i]);
                }
            }
            /**
             * @type {ObjectLikeDefineDirective|FunctionLikeDefineDirective}
             */
            const macro = context.findMacro(tokens[i].name);
            if (macro && !context.isMacroBeingReplaced(tokens[i].name)) {
                let replacements = null;
                let macroLength = null;
                if (macro instanceof ObjectLikeDefineDirective) {
                    // ... an object-like macro that causes each subsequent instance of the macro name 171) to be
                    // replaced by the replacement list of preprocessing tokens that constitute the remainder of the
                    // directive. The replacement list is then rescanned for more macro names ...
                    replacements = macro.replacements.map(e => {
                        let cloned = cloneNode(e);
                        inplaceCloneLocation(cloned);
                        cloned.location.start.line = tokens[i].location.start.line;
                        cloned.location.start.column = tokens[i].location.start.column;
                        cloned.location.end.line = tokens[i].location.start.line;
                        cloned.location.end.column = tokens[i].location.end.column;
                        return cloned;
                    });

                    macroLength = 1;
                } else if (macro instanceof FunctionLikeDefineDirective) {
                    // ... a function-like macro with parameters, whose use is similar syntactically to a function
                    // call. The parameters are specified by the optional list of identifiers, whose scope extends
                    // from their declaration in the identifier list until the new-line character that terminates
                    // the #define preprocessing directive.
                    // Each subsequent instance of the function-like macro name followed by a ( as the next
                    // preprocessing token introduces the sequence of preprocessing tokens that is replaced by the
                    // replacement list in the definition (an invocation of the macro).
                    if (!isPunctuator(tokens[i + 1], '(')) {
                        continue;
                    }
                    // The replaced sequence of preprocessing tokens is terminated by the matching )
                    // preprocessing token, skipping intervening matched pairs of left and right parenthesis
                    // preprocessing tokens. Within the sequence of preprocessing tokens making up an invocation of
                    // a function-like macro, new-line is considered a normal white-space character.
                    // The sequence of preprocessing tokens bounded by the outside-most matching parentheses forms
                    // the list of arguments for the function-like macro. The individual arguments within the list
                    // are separated by comma preprocessing tokens, but comma preprocessing tokens between matching
                    // inner parentheses do not separate arguments. If there are sequences of preprocessing tokens
                    // within the list of arguments that would otherwise act as preprocessing directives, 172) the
                    // behavior is undefined.
                    // If there is a ... in the identifier-list in the macro definition, then the trailing arguments,
                    // including any separating comma preprocessing tokens, are merged to form a single item: the
                    // variable arguments. The number of arguments so combined is such that, following merger, the
                    // number of arguments is one more than the number of parameters in the macro definition
                    // (excluding the ...).
                    let arguments_ = [];
                    const argumentCommas = [];
                    {
                        let parenthesisNestingLevel = 1;
                        let argument = [];
                        let j = i + 2;
                        for (; ; ++j) {
                            if (j >= tokens.length) {
                                throw new PreprocessingError('Unterminated function-like macro invocation', tokens[j - 1]);
                            }
                            const token = tokens[j];
                            if (isPunctuator(token, ',')) {
                                argumentCommas.push(token);
                                arguments_.push(argument);
                                argument = [];
                                continue;
                            } else if (isPunctuator(token, '(')) {
                                ++parenthesisNestingLevel;
                            } else if (isPunctuator(token, ')')) {
                                --parenthesisNestingLevel;
                                if (parenthesisNestingLevel === 0) {
                                    if (argument.length > 0) {
                                        arguments_.push(argument);
                                    }
                                    break;
                                }
                            }
                            argument.push(token);
                        }
                        macroLength = j - i + 1;
                    }
                    let parameterCount = macro.parameters.length;
                    if (macro.variableArguments) {
                        ++parameterCount;
                    }
                    if (arguments_.length < parameterCount) {
                        throw new PreprocessingError(`Macro "${macro.name.name}" requires ${parameterCount
                            } parameters, but only ${arguments_.length} given`, tokens[i]);
                    }
                    if (!macro.variableArguments && arguments_.length > parameterCount) {
                        throw new PreprocessingError(`Macro "${macro.name.name}" passed ${arguments_.length
                            } arguments, but takes just ${parameterCount}`, tokens[i]);
                    }
                    let variableArguments = null;
                    if (macro.variableArguments) {
                        variableArguments = arguments_[parameterCount - 1];
                        for (let j = parameterCount; j < arguments_.length; ++j) {
                            variableArguments.push(argumentCommas[j - 1]);
                            variableArguments = variableArguments.concat(arguments_[j]);
                        }
                        arguments_.splice(parameterCount - 1);
                    }
                    // Argument substitution
                    // After the arguments for the invocation of a function-like macro have been identified,
                    // argument substitution takes place.
                    const argumentMap = new Map();
                    for (const [j, argument] of arguments_.entries()) {
                        argumentMap.set(macro.parameters[j].name, argument);
                    }
                    if (macro.variableArguments) {
                        // An identifier __VA_ARGS__ that occurs in the replacement list shall be treated as if it
                        // were a parameter, and the variable arguments shall form the preprocessing tokens used to
                        // replace it.
                        argumentMap.set('__VA_ARGS__', variableArguments);
                    }
                    const isArgument = token => token instanceof Identifier && argumentMap.has(token.name);
                    replacements = macro.replacements.slice();
                    for (let j = 0; j < replacements.length; ++j) {
                        if (isArgument(replacements[j])) {
                            // A parameter in the replacement list, unless preceded by a # or ## preprocessing token
                            // or followed by a ## preprocessing token (see below), is replaced by the corresponding
                            // argument after all macros contained therein have been expanded.
                            if (!(isPunctuator(replacements[j - 1], '#')
                                || isPunctuator(replacements[j - 1], '##'))
                                || isPunctuator(replacements[j + 1], '##')) {
                                let argument = argumentMap.get(replacements[j].name);
                                // Before being substituted, each argument’s preprocessing tokens are completely
                                // macro replaced as if they formed the rest of the preprocessing file; no other
                                // preprocessing tokens are available.
                                argument = replaceMacroInvocations(argument, context.newChildContext(),
                                    enableDefined);
                                if (argument.length) {
                                    argument[0] = cloneNodeWithStartPositionForSpacing(argument[0],
                                        getNodeStartPositionForSpacing(replacements[j]));
                                    argument[argument.length - 1] = cloneNodeWithEndPositionForSpacing(
                                        argument[argument.length - 1],
                                        getNodeEndPositionForSpacing(replacements[j]));
                                }
                                replacements.splice(j, 1, ...argument);
                                j += argument.length - 1;
                            }
                        } else if (isPunctuator(replacements[j], '#')) {
                            // If, in the replacement list, a parameter is immediately preceded by a # preprocessing
                            // token, both are replaced by a single character string literal preprocessing token
                            // that contains the spelling of the preprocessing token sequence for the corresponding
                            // argument. Each occurrence of white space between the argument’s preprocessing tokens
                            // becomes a single space character in the character string literal. White space before
                            // the first preprocessing token and after the last preprocessing token composing the
                            // argument is deleted. Otherwise, the original spelling of each preprocessing token in
                            // the argument is retained in the character string literal, except for special handling
                            // for producing the spelling of string literals and character constants: a \ character
                            // is inserted before each " and \ character of a character constant or string literal
                            // (including the delimiting " characters), except that it is implementation-defined
                            // whether a \ character is inserted before the \ character beginning a universal
                            // character name. If the replacement that results is not a valid character string
                            // literal, the behavior is undefined. The character string literal corresponding to an
                            // empty argument is "". The order of evaluation of # and ## operators is unspecified.
                            const argument = argumentMap.get(replacements[j + 1].name);
                            let stringValue = '';
                            for (let k = 0; k < argument.length; ++k) {
                                if (k > 0) {
                                    stringValue += ' '.repeat(getNodeStartPositionForSpacing(argument[k])
                                        - getNodeEndPositionForSpacing(argument[k - 1]));
                                }
                                stringValue += argument[k].location.source;
                            }
                            const stringLiteralSource = `"${stringValue.replace(/["\\]/g, '\\$&')}"`;
                            const stringLiteral = new StringLiteral(new SourceLocation(stringLiteralSource,
                                replacements[j].location.start, replacements[j + 1].location.end), null,
                                stringValue);
                            replacements.splice(j, 2, stringLiteral);
                        } else if (isPunctuator(replacements[j], '##')) {
                            // If, in the replacement list of a function-like macro, a parameter is immediately
                            // preceded or followed by a ## preprocessing token, the parameter is replaced by the
                            // corresponding argument’s preprocessing token sequence; however, if an argument
                            // consists of no preprocessing tokens, the parameter is replaced by a placemarker
                            // preprocessing token instead. 173)
                            const replaceParameter = index => {
                                const argument = argumentMap.get(replacements[index].name);
                                if (argument.length) {
                                    argument[0] = cloneNodeWithStartPositionForSpacing(argument[0],
                                        getNodeStartPositionForSpacing(replacements[index]));
                                    argument[argument.length - 1] = cloneNodeWithEndPositionForSpacing(
                                        argument[argument.length - 1],
                                        getNodeEndPositionForSpacing(replacements[index]));
                                    replacements.splice(index, 1, ...argument);
                                    j += argument.length - 1;
                                } else {
                                    replacements[index] = placemarkerPpToken;
                                }
                            };
                            if (isArgument(replacements[j - 1])) {
                                replaceParameter(j - 1);
                            }
                            if (isArgument(replacements[j + 1])) {
                                replaceParameter(j + 1);
                            }
                        } else {
                            //reset other replacements' location to the macro identifier location
                            inplaceCloneLocation(replacements[j]);
                            replacements[j].location.start.line = tokens[i].location.start.line;
                            replacements[j].location.start.column = tokens[i].location.start.column;
                            replacements[j].location.end.line = tokens[i].location.start.line;
                            replacements[j].location.end.column = tokens[i].location.end.column;
                        }
                    }
                } else {
                    throw new PreprocessingError('Internal: Unknown type of macro', macro);
                }
                // For both object-like and function-like macro invocations, before the replacement list is
                // reexamined for more macro names to replace, each instance of a ## preprocessing token in the
                // replacement list (not from an argument) is deleted and the preceding preprocessing token is
                // concatenated with the following preprocessing token. Placemarker preprocessing tokens are handled
                // specially: concatenation of two placemarkers results in a single placemarker preprocessing token,
                // and concatenation of a placemarker with a non-placemarker preprocessing token results in the
                // non-placemarker preprocessing token. If the result is not a valid preprocessing token, the
                // behavior is undefined. The resulting token is available for further macro replacement. The order
                // of evaluation of ## operators is unspecified.
                for (let j = 0; j < replacements.length; ++j) {
                    if (isPunctuator(replacements[j], '##')) {
                        if (macro instanceof FunctionLikeDefineDirective
                            && !isTokenInReplacementList(replacements[j])) {
                            continue;
                        }
                        if (replacements[j - 1] === placemarkerPpToken) {
                            replacements.splice(j - 1, 2);
                        } else if (replacements[j + 1] === placemarkerPpToken) {
                            replacements.splice(j, 2);
                        } else {
                            const source = replacements[j - 1].location.source
                                + replacements[j + 1].location.source;
                            try {
                                const token = PreprocessingTokenParser.parse(source, { preprocessing: true });
                                token.location.start = replacements[j - 1].location.start;
                                token.location.end = replacements[j + 1].location.end;
                                // We are creating a new token, no need to clone.
                                //noinspection JSDeprecatedSymbols
                                overrideNodeStartPositionForSpacing(token,
                                    getNodeStartPositionForSpacing(replacements[j - 1]));
                                //noinspection JSDeprecatedSymbols
                                overrideNodeEndPositionForSpacing(token, getNodeEndPositionForSpacing(replacements[j + 1]));
                                markTokenAsConcatenated(token);
                                replacements.splice(j - 1, 3, token);
                            } catch (e) {
                                // TODO
                                e.location.start = replacements[j - 1].location.start;
                                e.location.end = replacements[j + 1].location.end;
                                // throw e;
                                throw new PreprocessingError(`pasting "${replacements[j - 1].location.source}" and "${
                                    replacements[j + 1].location.source
                                    }" does not give a valid preprocessing token`, replacements[j - 1]);
                            }
                        }
                        --j;
                    }
                }
                // Rescanning and further replacement
                // After all parameters in the replacement list have been substituted and # and ## processing has
                // taken place, all placemarker preprocessing tokens are removed. The resulting preprocessing token
                // sequence is then rescanned, along with all subsequent preprocessing tokens of the source file,
                // for more macro names to replace.
                // If the name of the macro being replaced is found during this scan of the replacement list (not
                // including the rest of the source file’s preprocessing tokens), it is not replaced. Furthermore,
                // if any nested replacements encounter the name of the macro being replaced, it is not replaced.
                // These nonreplaced macro name preprocessing tokens are no longer available for further replacement
                // even if they are later (re)examined in contexts in which that macro name preprocessing token
                // would otherwise have been replaced.
                // The resulting completely macro-replaced preprocessing token sequence is not processed as a
                // preprocessing directive even if it resembles one, but all pragma unary operator expressions
                // within it are then processed as specified in 6.10.9 below.
                replacements = replacements.filter(replacement => replacement !== placemarkerPpToken);
                const childContext = context.newChildContext();
                childContext.markMacroAsBeingReplaced(macro.name.name);
                replacements = replaceMacroInvocations(replacements, context.newChildContext(),
                    enableDefined);
                if (replacements.length) {
                    replacements[0] = cloneNodeWithStartPositionForSpacing(replacements[0],
                        getNodeStartPositionForSpacing(tokens[i]));
                    replacements[replacements.length - 1] = cloneNodeWithEndPositionForSpacing(
                        replacements[replacements.length - 1],
                        getNodeEndPositionForSpacing(tokens[i + macroLength - 1]));
                }
                tokens.splice(i, macroLength, ...replacements);
                i += replacements.length - macroLength;
            }
        }
    }
    return tokens;
}

/**
 * @param {[Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar]} tokens
 * @param {PreprocessingContext} context
 * @param {boolean} preserveDefined
 * @return {[Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar]}
 */
function replaceMacroInvocations(tokens, context, preserveDefined = false) {
    tokens = tokens.slice();
    replaceMacroInvocationsInPlace(tokens, context, preserveDefined);
    return tokens;
}

const isInReplacementListProperty = Symbol('isInReplacementList');

/**
 * @param {Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar} token
 */
function markTokenAsInReplacementList(token) {
    token[isInReplacementListProperty] = true;
}

/**
 * @param {Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar} token
 * @return {boolean}
 */
function isTokenInReplacementList(token) {
    return !!token[isInReplacementListProperty];
}

const isConcatenatedProperty = Symbol('isConcatenated');

/**
 * @param {Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar} token
 */
function markTokenAsConcatenated(token) {
    token[isConcatenatedProperty] = true;
}

/**
 * @param {Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar} token
 * @return {boolean}
 */
function isTokenConcatenated(token) {
    return !!token[isConcatenatedProperty];
}

/**
 * @param {Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar} token
 * @param {string} punctuator
 * @return {boolean}
 */
function isPunctuator(token, punctuator) {
    if (typeof token === 'undefined') {
        return false;
    }
    if (isTokenConcatenated(token)) {
        return false;
    }
    return token instanceof Punctuator && token.value === punctuator;
}

/**
 * @param {*} node
 * @return {*}
 */
function cloneNode(node) {
    return Object.assign(Object.create(node), node);
}

/**
 * @param {Node} node 
 */
function inplaceCloneLocation(node) {
    node.location.start = cloneNode(node.location.start);
    node.location.end = cloneNode(node.location.end);
    node.location = cloneNode(node.location);
    return node.location;
}

const spacingStartPositionProperty = Symbol('spacingStartPosition');

/**
 * @param {Node} node
 * @param {Position} position
 * @deprecated Use #cloneNodeWithStartPositionForSpacing instead.
 */
function overrideNodeStartPositionForSpacing(node, position) {
    node[spacingStartPositionProperty] = position;
}

/**
 * @param {Node} node
 * @param {Position} position
 */
function cloneNodeWithStartPositionForSpacing(node, position) {
    node = cloneNode(node);
    //noinspection JSDeprecatedSymbols
    overrideNodeStartPositionForSpacing(node, position);
    return node;
}

/**
 * @param {Node} node
 * @return {Position}
 */
function getNodeStartPositionForSpacing(node) {
    let offset = node[spacingStartPositionProperty];
    if (typeof offset === 'undefined') {
        offset = node.location.start;
    }
    return offset;
}

const spacingEndPositionProperty = Symbol('spacingEndPosition');

/**
 * @param {Node} node
 * @param {Position} position
 * @deprecated Use #cloneNodeWithEndPositionForSpacing instead.
 */
function overrideNodeEndPositionForSpacing(node, position) {
    node[spacingEndPositionProperty] = position;
}

/**
 * @param {Node} node
 * @param {Position} position
 */
function cloneNodeWithEndPositionForSpacing(node, position) {
    node = cloneNode(node);
    //noinspection JSDeprecatedSymbols
    overrideNodeEndPositionForSpacing(node, position);
    return node;
}

/**
 * @param {Node} node
 * @return {Position}
 */
function getNodeEndPositionForSpacing(node) {
    let position = node[spacingEndPositionProperty];
    if (typeof position === 'undefined') {
        position = node.location.end;
    }
    return position;
}

/**
 * @param {Node} node
 * @param {[Node]} children
 */
function cloneNodeWithOffsetForSpacingAsChildren(node, children) {
    node = cloneNodeWithStartPositionForSpacing(node, getNodeStartPositionForSpacing(children[0]));
    //noinspection JSDeprecatedSymbols
    overrideNodeEndPositionForSpacing(node, getNodeEndPositionForSpacing(children[children.length - 1]));
    return node;
}

/**
 * @param {Node} node
 * @param {[Node]} children
 * @param {PreprocessingContext} context
 * @return {string}
 */
function getCodeFromNodeWithChildren(node, children, context) {
    let code = '';
    const source = context.getSource();
    let lastOffset = getNodeStartPositionForSpacing(node).offset;
    for (const child of children) {
        // TODO: Remove.
        if (lastOffset > getNodeStartPositionForSpacing(child)) {
            debugger;
            throw new PreprocessingError('Internal: lastOffset > getNodeStartPositionForSpacing(child).offset', child);
        }
        code += source.substring(lastOffset, getNodeStartPositionForSpacing(child).offset);
        code += child.location.source;
        lastOffset = getNodeEndPositionForSpacing(child);
    }
    // TODO: Remove.
    if (lastOffset > getNodeEndPositionForSpacing(node)) {
        debugger;
        throw new PreprocessingError('Internal: lastOffset > getNodeEndPositionForSpacing(node).offset', node);
    }
    code += source.substring(lastOffset, getNodeEndPositionForSpacing(node).offset);
    return code;
}

/**
 * @param {Node} node
 * @param {[Node]} children
 * @param {PreprocessingContext} context
 * @param {function(Node):(SourceNode|null)} toSourceNode
 * @return {SourceNode}
 */
function getSourceNodeFromNodeWithChildren(node, children, context, toSourceNode) {
    let sourceNode = new SourceNode(node.location.start.line, node.location.start.column, context.getFileName());
    const source = context.getSource();
    let lastPosition = getNodeStartPositionForSpacing(node);
    const addSpaceSourceNode = endPosition => {
        // DISABLED: Shouldn't do the line separation here, as we won't do it for included files.
        //const spaceSource = source.substring(lastPosition.offset, endPosition.offset);
        //const spaceSourceLines = spaceSource.split('\n');
        //for (let i = 0; i < spaceSourceLines.length - 1; ++i) {
        //    spaceSourceLines[i] += '\n';
        //}
        //if (!spaceSourceLines[spaceSourceLines.length - 1]) {
        //    spaceSourceLines.splice(-1, 1);
        //}
        //for (const [i, spaceSourceLine] of spaceSourceLines.entries()) {
        //    sourceNode.add(new SourceNode(lastPosition.line + i, i === 0 ? lastPosition.column : 0,
        //            context.getFileName(), spaceSourceLine));
        //}
        sourceNode.add(new SourceNode(lastPosition.line, lastPosition.column, context.getFileName(),
            source.substring(lastPosition.offset, endPosition.offset)));
    };
    for (const child of children) {
        // TODO: Remove.
        if (lastPosition.offset > getNodeStartPositionForSpacing(child).offset) {
            debugger;
            throw new PreprocessingError('Internal: lastPosition.offset > getNodeStartPositionForSpacing(child).offset',
                child);
        }
        addSpaceSourceNode(getNodeStartPositionForSpacing(child));
        const childSourceNode = toSourceNode(child);
        if (childSourceNode) {
            sourceNode.add(childSourceNode);
        }
        lastPosition = getNodeEndPositionForSpacing(child);
    }
    // TODO: Remove.
    if (lastPosition.offset > getNodeEndPositionForSpacing(node).offset) {
        debugger;
        throw new PreprocessingError('Internal: lastPosition.offset > getNodeEndPositionForSpacing(node).offset', node);
    }
    addSpaceSourceNode(getNodeEndPositionForSpacing(node));
    return sourceNode;
}

export default {
    process
};
