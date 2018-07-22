/* tslint:disable */
export default `
// TODO: Clean up for null or empty array.
// NOTE: &! is a custom peg.js transformation implemented in the custom loader.
{
    //const Long = require('long');
    //const Ty = require('../type');
  
    const getStorageClassSpecifierFromSpecifiers = Ty.getStorageClassSpecifierFromSpecifiers;
   
    
    function getDeclaratorIdentifierName(declarator) {
        return declarator instanceof AST.IdentifierDeclarator ? declarator.identifier.name
            : getDeclaratorIdentifierName(declarator.declarator);
    }

    function newPosition(position) {
        // For compatibility with source map.
        return new AST.Position(position.offset, position.line, position.column - 1);
    }

    function getLocation() {
        const location_ = location();
        return new AST.SourceLocation(options.fileName, text(), newPosition(location_.start), newPosition(location_.end));
    }

    function extractOptional(optional, index) {
        return optional ? optional[index] : null;
    }

    function extractList(list, index) {
        return list.map(element => element[index]);
    }

    function buildList(head, tail, index) {
        return [head].concat(extractList(tail, index));
    }

    function buildBinaryExpression(head, tail) {
        return tail.reduce((result, element) => new AST.BinaryExpression(getLocation(), element[1], result, element[3]), head);
    }

    /**
     * @param {string} hexSequence
     */
    function parseUniversalCharacter(hexSequence) {
        // SAFE_NUMBER: At most 0xFFFFFFFF.
        const charCode = Number.parseInt(hexSequence, 16);
        // The disallowed characters are the characters in the basic character set and the code positions reserved by
        // ISO/IEC 10646 for control characters, the character DELETE, and the S-zone (reserved for use by UTF−16).
        if ((charCode >= 0x0000 && charCode <= 0x001F)
                || (charCode >= 0x007F && charCode <= 0x009F)
                || (charCode >= 0xD800 && charCode <= 0xDFFF)) {
            error('Disallowed character in universal character name: 0x' + hexSequence, getLocation());
        }
        return String.fromCharCode(charCode);
    }

    let hasTypeSpecifier = false;

    let scopeRoot = { parent: null, typedefNames: new Map() };
    let currScope = scopeRoot;

    function enterScope() {
        currScope = { parent: currScope, typedefNames: new Map() };
    }

    function exitScope() {
        currScope = currScope.parent;
    }

    function isTypedefName(name) {
        let c = currScope;
        while(c != null) {
            if (c.typedefNames.has(name)) {
                //console.log(name, 'is typedef name');
                return c.typedefNames.get(name);
            }
            c = c.parent;
        }
        //console.log(name, 'is not typedef name');
        return false;
    }
}

Start
    = TranslationUnit

// ADDED
WhiteSpace
    = [ \\t\\n\\v\\f]

// ADDED
// The only white-space characters that shall appear between preprocessing tokens within a preprocessing directive (from
// just after the introducing # preprocessing token through just before the terminating new-line character) are space
// and horizontal-tab (including spaces that have replaced comments or possibly other white-space characters in
// translation phase 3).
PpWhiteSpace ''
    = [ \\t\\v\\f]

// ADDED
Comment 'comment'
    = '/*' value:$(!'*/' .)* '*/' {
        return new AST.MultiLineComment(getLocation(), value);
    }
    / '//' value:$[^\\n]* {
        return new AST.SingleLineComment(getLocation(), value);
    }

// ADDED
_ 'white space'
    = ((!{ return options.preprocessing } WhiteSpace / PpWhiteSpace) / Comment)*

// A.1 Lexical grammar

// A.1.1 Lexical elements

// UNUSED
Token
    = Keyword
    / Identifier
    / Constant
    / StringLiteral
    / Punctuator

// REMOVED: HeaderName
PreprocessingToken
    = Identifier
    / PpNumber
    / CharacterConstant
    / StringLiteral
    / Punctuator
    / PpChar

// ADDED
PpChar
    = char:[^\\u0000-\\u007F] { //reject non-ascii char
        error('Unsupported source code character ' + char + '.');
    }
    / [^ \\t\\r\\n\\v\\f] { // each non-white-space character that cannot be one of the above
        return new AST.PpChar(getLocation(), text());
    }

// A.1.2 Keywords

// UNUSED
// REORDER
Keyword
    = ('auto'
    / 'break'
    / 'case'
    / 'char'
    / 'const'
    / 'continue'
    / 'default'
    / 'double'
    / 'do'
    / 'else'
    / 'enum'
    / 'extern'
    / 'float'
    / 'for'
    / 'goto'
    / 'if'
    / 'inline'
    / 'int'
    / 'long'
    / 'register'
    / 'restrict'
    / 'return'
    / 'short'
    / 'signed'
    / 'sizeof'
    / 'static'
    / 'struct'
    / 'switch'
    / 'typedef'
    / 'union'
    / 'unsigned'
    / 'void'
    / 'volatile'
    / 'while'
    / '_Alignas'
    / '_Alignof'
    / '_Atomic'
    / '_Bool'
    / '_Complex'
    / '_Generic'
    / '_Imaginary'
    / '_Noreturn'
    / '_Static_assert'
    / '_Thread_local') !IdentifierPart {
        return text();
    }

// A.1.3 Identifiers

Id
    = (&{ return options.preprocessing } / !Keyword) head:IdentifierNondigit tail:IdentifierPart* {
        return new AST.Identifier(getLocation(), head + tail.join(''));
    }

SingleIdentifier
    = id:Id &{
        return !isTypedefName(id.name)
    } {
        return id;
    }
    
Identifier 
    = isFullName:'::'? namespace:(Id '::')* name:SingleIdentifier {
        let prefix = isFullName === "::" ? "::" : "";
        name.name = prefix + namespace.map(x=>x[0].name+"::").join("") + name.name;
        return name;
    }

// ADDED
IdentifierPart
    = IdentifierNondigit
    / Digit

// REORDER: UniversalCharacterName / Nondigit
IdentifierNondigit
    = UniversalCharacterName
    / Nondigit
    // other implementation-defined characters

Nondigit
    = [_a-zA-Z]

Digit
    = [0-9]

// A.1.4 Universal character names

UniversalCharacterName
    = '\\\\u' hexQuad:$HexQuad {
        return parseUniversalCharacter(hexQuad);
    }
    / '\\\\U' hexQuads:$(HexQuad HexQuad) {
        return parseUniversalCharacter(hexQuads);
    }

HexQuad
    = HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit

// A.1.5 Constants

// REORDER: FloatingConstant / IntegerConstant
// REMOVED: EnumerationConstant
Constant
    = FloatingConstant
    / IntegerConstant
    / CharacterConstant

IntegerConstant
    // REORDER: HexadecimalConstant / OctalConstant
    = integer:(constant:(DecimalConstant / HexadecimalConstant / OctalConstant) {
        return {
            base: constant.base,
            value: constant.value,
            raw: text()
        }
        }) suffix:$IntegerSuffix? {
        if (suffix.toLowerCase().includes('u')) {
            integer.value.unsigned = true;
        }
        return new AST.IntegerConstant(getLocation(), integer.base, integer.value, integer.raw, suffix || null);
    }

DecimalConstant
    = NonzeroDigit Digit* {
        // SAFE_NUMBER: Using Long.
        return {
            base: 10,
            value: Long.fromString(text())
        };
    }

OctalConstant
    = '0' digits:$OctalDigit* {
        // SAFE_NUMBER: Using Long.
        return {
            base: 8,
            value: digits.length ? Long.fromString(digits, 8) : Long.ZERO
        };
    }

HexadecimalConstant
    = HexadecimalPrefix digits:$HexadecimalDigit+ {
        // SAFE_NUMBER: Using Long.
        return {
            base: 16,
            value: Long.fromString(digits, 16)
        };
    }

HexadecimalPrefix
    = '0x'
    / '0X'

NonzeroDigit
    = [1-9]

OctalDigit
    = [0-7]

HexadecimalDigit
    = [0-9a-fA-F]

IntegerSuffix
    = UnsignedSuffix (LongLongSuffix / LongSuffix)?
    / (LongLongSuffix / LongSuffix) UnsignedSuffix?

UnsignedSuffix
    = [uU]

LongSuffix
    = [lL]

LongLongSuffix
    = 'll'
    / 'LL'

FloatingConstant
    = DecimalFloatingConstant

DecimalFloatingConstant
    = raw:$((FractionalConstant ExponentPart?) / (DigitSequence ExponentPart)) suffix:$FloatingSuffix? {
        // TODO: Check for NaN, Infinity, etc.
        return new AST.FloatingConstant(getLocation(), Number.parseFloat(raw), raw, suffix || null);
    }


FractionalConstant
    = DigitSequence '.' DigitSequence?
    / '.' DigitSequence

ExponentPart
    = [eE] Sign? DigitSequence

Sign
    = [+\\-]

DigitSequence
    = Digit+

HexadecimalFractionalConstant
    = HexadecimalDigitSequence '.' HexadecimalDigitSequence?
    / '.' HexadecimalDigitSequence

BinaryExponentPart
    = [pP] Sign? DigitSequence

HexadecimalDigitSequence
    = HexadecimalDigit+

FloatingSuffix
    = [flFL]

CharacterConstant
    = prefix:$[LuU]? '\\'' value:CCharSequence '\\'' {
        return new AST.CharacterConstant(getLocation(), value, prefix || null);
    }

CCharSequence
    = chars:CChar+ {
        return chars.join('');
    }

CChar
    = [^'\\\\\\n] // any member of the source character set except the single-quote ', backslash \\, or new-line character
    / EscapeSequence

EscapeSequence
    = SimpleEscapeSequence
    / OctalEscapeSequence
    / HexadecimalEscapeSequence
    / UniversalCharacterName

SimpleEscapeSequence
    = ('\\\\\\''
    / '\\\\"'
    / '\\\\?'
    / '\\\\\\\\') {
        return text().charAt(1);
    }
    / '\\\\a' {
        return '\\x07';
    }
    / '\\\\b' {
        return '\\b';
    }
    / '\\\\f' {
        return '\\f';
    }
    / '\\\\n' {
        return '\\n';
    }
    / '\\\\r' {
        return '\\r';
    }
    / '\\\\t' {
        return '\\t';
    }
    / '\\\\v' {
        return '\\v';
    }

OctalEscapeSequence
    = '\\\\' digits:$(OctalDigit OctalDigit? OctalDigit?) {
        // SAFE_NUMBER: At most 0777.
        return String.fromCharCode(Number.parseInt(digits, 8));
    }

HexadecimalEscapeSequence
    = '\\\\x' digits:$HexadecimalDigit+ {
        // TODO: Guard against very long digits.
        return String.fromCharCode(Number.parseInt(digits, 16));
    }

// A.1.6 String literals

// MODIFIED: Support string literal concatenation.
// In translation phase 6, the multibyte character sequences specified by any sequence of adjacent character and
// identically-prefixed string literal tokens are concatenated into a single multibyte character sequence. If any of the
// tokens has an encoding prefix, the resulting multibyte character sequence is treated as having the same prefix;
// otherwise, it is treated as a character string literal. Whether differently-prefixed wide string literal tokens can
// be concatenated and, if so, the treatment of the resulting multibyte character sequence are implementation-defined.
// In translation phase 7, a byte or code of value zero is appended to each multibyte character sequence that results
// from a string literal or literals. 78)
StringLiteral
    = head:SingleStringLiteral tail:(_ SingleStringLiteral)* {
        return buildList(head, tail, 1).reduce((left, right) => {
            let prefix = null;
            if (left.prefix !== right.prefix) {
                if (left.prefix) {
                    if (right.prefix) {
                        error('Unsupported non-standard concatenation of string literals');
                    } else {
                        prefix = left.prefix;
                    }
                } else {
                    prefix = right.prefix;
                }
            } else {
                prefix = left.prefix;
            }
            const value = left.value.slice(0, -1) + right.value;
            return new AST.StringLiteral(getLocation(), prefix, value);
        });
    }

// ADDED
SingleStringLiteral
    = prefix:$EncodingPrefix? '"' value:SCharSequence? &!'"' {
        return new AST.StringLiteral(getLocation(), prefix || null, (value || '') + '\\0');
    }

EncodingPrefix
    = 'u8'
    / 'u'
    / 'U'
    / 'L'

SCharSequence
    = chars:SChar+ {
        return chars.join('');
    }

SChar
    = [^"\\\\\\n] // any member of the source character set except the double-quote ", backslash \\, or new-line character
    / EscapeSequence

// A.1.7 Punctuators

// REORDER
Punctuator
    = ('['
    / ']'
    / '('
    / ')'
    / '{'
    / '}'
    / '=='
    / '!=' 
    / '...'
    / '.'
    / '->'
    / '++'
    / '--'
    / '&&'
    / '&'
    / '*='
    / '/='
    / '%='
    / '+='
    / '-='
    / '<<='
    / '*'
    / '+'
    / '-'
    / '~'
    / '!'
    / '/'
    / '<%'
    / '%>'
    / '%:%:'
    / '%:'
    / '%'
    / '<<'
    / '>>'
    / '<='
    / '>='
    / '<:'
    / ':>'
    / '<'
    / '>'
    / '?'
    / ':'
    / ';'
    / '='
    / ','
    / '##'
    / '#') {
        return new AST.Punctuator(getLocation(), text());
    }

// A.1.8 Header names

HeaderName '<file name> or \\"file name\\"'
    = '<' name:HCharSequence '>' {
        return new AST.HeaderName(getLocation(), name, false);
    }
    / '"' name:QCharSequence '"' {
        return new AST.HeaderName(getLocation(), name, true);
    }

HCharSequence
    = chars:HChar+ {
        return chars.join('');
    }

HChar
    = [^\\n>] // any member of the source character set except the new-line character and >

QCharSequence
    = chars:QChar+ {
        return chars.join('');
    }

QChar
    = [^\\n"] // any member of the source character set except the new-line character and "

// A.1.9 Preprocessing numbers

PpNumber
    = '.'? Digit (Digit / IdentifierNondigit / [eEpP] Sign / '.')* {
        return new AST.PpNumber(getLocation(), text());
    }

// A.2 Phrase structure grammar

// A.2.1 Expressions

AndAnd
    = '&&'

SingleAnd
    = '&'!'&'{
        return text();
    }

PrimaryExpression
    = Identifier
    / Constant
    / StringLiteral
    / '(' _ expression:Expression _ &!')' {
        return new AST.ParenthesisExpression(getLocation(), expression);
    }
    / GenericSelection

GenericSelection
    = '_Generic' _ &!'(' _ discriminant:AssignmentExpression _ &!',' _ associations:GenericAssocList _ &!')' {
        return new AST.GenericSelection(getLocation(), discriminant, associations);
    }

GenericAssocList
    = head:GenericAssociation tail:(_ ',' _ GenericAssociation)* {
        return buildList(head, tail, 3);
    }

// REORDER: 'default' / TypeName
GenericAssociation
    = test:('default' / TypeName) _ &!':' _ consequent:AssignmentExpression {
        return new AST.GenericAssociation(getLocation(), test === 'default' ? null : test, consequent);
    }

// ADDED
CompoundLiteral
    = '(' _ typeName:TypeName _ ')' _ '{' _ initializerList:InitializerList _ ','? _ &!'}' {
        return new AST.CompoundLiteral(getLocation(), typeName, initializerList);
    }

PostfixExpression
    = head:(PrimaryExpression / CompoundLiteral) tail:(_ (
        '[' _ subscript:Expression _ &!']' {
            return {
                type: AST.SubscriptExpression,
                arguments: [subscript]
            };
        }
        / '(' _ arguments_:ArgumentExpressionList? _ &!')' {
            return {
                type: AST.CallExpression,
                arguments: [arguments_ || []]
            };
        }
        / operator:('.' / '->') _ member:Identifier {
            return {
                type: AST.MemberExpression,
                arguments: [operator === '->', member]
            };
        }
        / operator:('++' / '--') {
            return {
                type: AST.PostfixExpression,
                arguments: [operator === '--']
            };
        }
    ))* {
        return extractList(tail, 1).reduce((result, element) => new element.type(getLocation(), result, ...element.arguments), head);
    }

ArgumentExpressionList
    = head:AssignmentExpression tail:(_ ',' _ AssignmentExpression)* {
        return buildList(head, tail, 3);
    }

UnaryExpression
    = operator:('++' / '--') _ operand:UnaryExpression {
        return new AST.UnaryExpression(getLocation(), operator, operand);
    }
    / operator:UnaryOperator _ operand:CastExpression { //Hack: when parse '&' operator, the operator variable will be array of 2 elements
        return new AST.UnaryExpression(getLocation(), operator[0], operand);
    }
    / operator:'sizeof' !IdentifierPart _ operand:UnaryExpression {
        return new AST.UnaryExpression(getLocation(), operator, operand);
    }
    / operator:('sizeof' / '_Alignof') _ '(' _ operand:TypeName _ &!')' {
        return new AST.UnaryExpression(getLocation(), operator, operand);
    }
    / PostfixExpression

UnaryOperator
    = [*+\\-~!]
    / SingleAnd

CastExpression
    = '(' _ typeName:TypeName _ ')' _ operand:CastExpression {
        return new AST.CastExpression(getLocation(), typeName, operand);
    }
    / UnaryExpression

MultiplicativeExpression
    = head:CastExpression tail:(_ [*/%] _ CastExpression)* {
        return buildBinaryExpression(head, tail);
    }

AdditiveExpression
    = head:MultiplicativeExpression tail:(_ [+\\-] _ MultiplicativeExpression)* {
        return buildBinaryExpression(head, tail);
    }

ShiftExpression
    = head:AdditiveExpression tail:(_ ('<<' / '>>') _ AdditiveExpression)* {
        return buildBinaryExpression(head, tail);
    }

// REORDER: '<=' / '>=' / '<' / '>'
RelationalExpression
    = head:ShiftExpression tail:(_ ('<=' / '>=' / '<' / '>') _ ShiftExpression)* {
        return buildBinaryExpression(head, tail);
    }

EqualityExpression
    = head:RelationalExpression tail:(_ ('==' / '!=') _ RelationalExpression)* {
        return buildBinaryExpression(head, tail);
    }

AndExpression
    = head:EqualityExpression tail:(_ SingleAnd _ EqualityExpression)* {
        return buildBinaryExpression(head, tail);
    }

ExclusiveOrExpression
    = head:AndExpression tail:(_ '^' _ AndExpression)* {
        return buildBinaryExpression(head, tail);
    }

InclusiveOrExpression
    = head:ExclusiveOrExpression tail:(_ '|' _ ExclusiveOrExpression)* {
        return buildBinaryExpression(head, tail);
    }

LogicalAndExpression
    = head:InclusiveOrExpression tail:(_ AndAnd _ InclusiveOrExpression)* {
        return buildBinaryExpression(head, tail);
    }

LogicalOrExpression
    = head:LogicalAndExpression tail:(_ '||' _ LogicalAndExpression)* {
        return buildBinaryExpression(head, tail);
    }

ConditionalExpression
    = test:LogicalOrExpression _ '?' _ consequent:Expression _ &!':' _ alternate:ConditionalExpression {
        return new AST.ConditionalExpression(getLocation(), test, consequent, alternate);
    }
    / LogicalOrExpression

AssignmentExpression
    = left:UnaryExpression _ operator:AssignmentOperator _ right:AssignmentExpression {
        return new AST.AssignmentExpression(getLocation(), operator, left, right);
    }
    / ConditionalExpression

AssignmentOperator
    = '=' !'=' {
        return text();
    }
    / '*='
    / '/='
    / '%='
    / '+='
    / '-='
    / '<<='
    / '>>='
    / '&='
    / '^='
    / '|='

Expression
    = head:AssignmentExpression tail:(_ ',' _ AssignmentExpression)* {
        return buildBinaryExpression(head, tail);
    }

ConstantExpression
    = ConditionalExpression

// A.2.2 Declarations

Declaration 'declaration'
    = specifiers:DeclarationSpecifiers _ initDeclarators:InitDeclaratorList? _ ';' {
        let declaration = new AST.Declaration(getLocation(), specifiers, initDeclarators || []);
        try {
            const storageClassSpecifier = getStorageClassSpecifierFromSpecifiers(declaration.specifiers, declaration);
            let isTypedefName = storageClassSpecifier === 'typedef';
            for (const initDeclarator of declaration.initDeclarators) {
                const name = getDeclaratorIdentifierName(initDeclarator.declarator);
                currScope.typedefNames.set(name, isTypedefName);
            }
        } catch (e) { /*hide error until at syntax-check */ }
        return declaration;
    }
    / StaticAssertDeclaration

DeclarationWithoutSemicolon
    = specifiers:DeclarationSpecifiers _ initDeclarators:InitDeclaratorList?

DeclarationMissingSemicolon 'declaration'
    = DeclarationWithoutSemicolon {
        error('Missing \\';\\' at end of declaration');
    }

DeclarationSpecifiers
    = head:DeclarationSpecifier tail:(_ DeclarationSpecifier)* {
        hasTypeSpecifier = false;
        return buildList(head, tail, 1);
    }

// ADDED
// REORDER: * / TypeSpecifier
DeclarationSpecifier
    = StorageClassSpecifier
    / TypeQualifier
    / FunctionSpecifier
    / AlignmentSpecifier
    / TypeSpecifier

InitDeclaratorList
    = head:InitDeclarator tail:(_ ',' _ InitDeclarator)* {
        return buildList(head, tail, 3);
    }

InitDeclarator
    = declarator:Declarator initializer:(_ '=' _ Initializer)? {
        return new AST.InitDeclarator(getLocation(), declarator, extractOptional(initializer, 3));
    }

StorageClassSpecifier
    = ('typedef'
    / 'extern'
    / 'static'
    / 'virtual'
    / '_Thread_local'
    / 'auto'
    / 'register') !IdentifierPart {
        return text();
    }

TypeSpecifier
    = typeSpecifier:(('void'
    / 'char'
    / 'short'
    / 'int'
    / 'long'
    / 'float'
    / 'double'
    / 'signed'
    / 'unsigned'
    / '_Bool'
    / '_Complex') !IdentifierPart {
        return text();
    }
    / AtomicTypeSpecifier
    / StructOrUnionSpecifier
    / EnumSpecifier
    / (!{
        return hasTypeSpecifier;
    } typedefName:TypedefName {
        return typedefName;
    })) {
        hasTypeSpecifier = true;
        return typeSpecifier;
    }

StructOrUnionSpecifier
    = structOrUnion:StructOrUnion _ identifier:Identifier? _ '{' _ declarations:StructDeclarationList _ &!'}' {
        if( options.isCpp ) { currScope.typedefNames.set(identifier.name, true); }
        return new AST.StructOrUnionSpecifier(getLocation(), structOrUnion === 'union', identifier, declarations);
    }
    / structOrUnion:StructOrUnion _ identifier:Identifier '{' _ &!'}'{
        if( options.isCpp ) { currScope.typedefNames.set(identifier.name, true); }
        return new AST.StructOrUnionSpecifier(getLocation(), structOrUnion === 'union', identifier, []);
    }
    / structOrUnion:StructOrUnion _ identifier:Identifier {
        if( options.isCpp ) { currScope.typedefNames.set(identifier.name, true); }
        return new AST.StructOrUnionSpecifier(getLocation(), structOrUnion === 'union', identifier, null);
    }

StructOrUnion
    = ('struct'
    / 'union') !IdentifierPart {
        return text();
    }

StructDeclarationList
    = head:ExternalDeclaration tail:(_ ExternalDeclaration)* {
        return buildList(head, tail, 1);
    }

StructDeclaration
    = specifierQualifiers:SpecifierQualifierList declarators:(_ StructDeclaratorList)? _ &!';' {
        return new AST.StructDeclaration(getLocation(), specifierQualifiers, extractOptional(declarators, 1) || []);
    }
    / StaticAssertDeclaration

SpecifierQualifierList
    = head:SpecifierQualifier tail:(_ SpecifierQualifier)* {
        hasTypeSpecifier = false;
        return buildList(head, tail, 1);
    }

// ADDED
// REORDER: TypeQualifier / TypeSpecifier
SpecifierQualifier
    = TypeQualifier
    / TypeSpecifier

StructDeclaratorList
    = head:StructDeclarator tail:(_ ',' _ StructDeclarator)* {
        return buildList(head, tail, 3);
    }

StructDeclarator
    = ':' _ width:ConstantExpression {
        return new AST.StructDeclarator(getLocation(), null, width, null);
    }
    / declarator:Declarator _ initDeclarators:InitDeclaratorList? width:(_ ':' _ ConstantExpression)? {
        return new AST.StructDeclarator(getLocation(), declarator, extractOptional(width, 3), initDeclarators);
    }

EnumSpecifier
    = 'enum' !IdentifierPart _ identifier:Identifier? _ '{' _ enumerators:EnumeratorList _ ','? _ &!'}' {
        return new AST.EnumSpecifier(getLocation(), identifier, enumerators);
    }
    / 'enum' !IdentifierPart _ identifier:Identifier {
        return new AST.EnumSpecifier(getLocation(), identifier, null);
    }

EnumeratorList
    = head:Enumerator tail:(_ comma:','? _ enumerator:Enumerator)* {
        return buildList(head, tail, 3);
    }

// MODIFICATION: EnumerationConstant => Identifier
Enumerator
    = identifier:Identifier value:(_ '=' _ ConstantExpression)? {
        return new AST.Enumerator(getLocation(), identifier, extractOptional(value, 3));
    }

AtomicTypeSpecifier
    = '_Atomic' _ '(' _ typeName:TypeName _ &!')' {
        return new AST.AtomicTypeSpecifier(getLocation(), typeName);
    }

TypeQualifier
    = ('const'
    / 'restrict'
    / 'volatile'
    / '_Atomic') !IdentifierPart {
        return text();
    }

FunctionSpecifier
    = ('inline'
    / '_Noreturn'
    / '__libcall') !IdentifierPart {
        return text();
    }

// TODO: Reorder: ? TypeName / ConstantExpression
AlignmentSpecifier
    = '_Alignas' _ &!'(' _ alignment:(TypeName / ConstantExpression) _ &!')' {
        return new AST.AlignmentSpecifier(getLocation(), alignment);
    }

Declarator
    = pointer:(Pointer _)? declarator:DirectDeclarator {
        return pointer ? new AST.PointerDeclarator(getLocation(), declarator, extractOptional(pointer, 0)) : declarator;
    }

DirectDeclarator
    = head:(identifier:Identifier {
        return new AST.IdentifierDeclarator(getLocation(), identifier);
    } / '(' _ declarator:Declarator _ &!')' {
        return declarator;
    }) tail:(_ (
        '[' _ qualifiers:TypeQualifierList? _ length:AssignmentExpression? _ &!']' {
            return {
                location: getLocation(),
                type: AST.ArrayDeclarator,
                arguments: [false, qualifiers || [], length, false]
            };
        }
        / '[' _ 'static' !IdentifierPart _ qualifiers:TypeQualifierList? _ length:AssignmentExpression _ &!']' {
            return {
                location: getLocation(),
                type: AST.ArrayDeclarator,
                arguments: [true, qualifiers || [], length, false]
            };
        }
        / '[' _ qualifiers:TypeQualifierList _ 'static' !IdentifierPart _ length:AssignmentExpression _ &!']' {
            return {
                location: getLocation(),
                type: AST.ArrayDeclarator,
                arguments: [true, qualifiers, length, false]
            };
        }
        / '[' _ qualifiers:TypeQualifierList? _ '*' _ &!']' {
            return {
                location: getLocation(),
                type: AST.ArrayDeclarator,
                arguments: [false, qualifiers || [], null, true]
            };
        }
        / '(' _ parameters:(ParameterList / IdentifierList)? _ &!')' {
            return {
                location: getLocation(),
                type: AST.FunctionDeclarator,
                arguments: [parameters || new AST.ParameterList(getLocation())]
            }
        }
    ))* {
        return extractList(tail, 1).reduce((result, element) => new element.type(element.location, result, ...element.arguments), head);
    }

Pointer
    = '*' _ qualifiers:TypeQualifierList? _ pointer:Pointer? {
        return new AST.Pointer(getLocation(), qualifiers || [], pointer, '*');
    }
    /
    '&' _ qualifiers:TypeQualifierList? _ pointer:Pointer? {
        return new AST.Pointer(getLocation(), qualifiers || [], pointer, '&');
    }
    /
    '&&' _ qualifiers:TypeQualifierList? _ pointer:Pointer? {
        return new AST.Pointer(getLocation(), qualifiers || [], pointer, '&&');
    }

TypeQualifierList
    = head:TypeQualifier tail:(_ TypeQualifier)* {
        return buildList(head, tail, 1);
    }

// MERGED: ParameterTypeList => ParameterList
ParameterList
    = head:ParameterDeclaration tail:(_ ',' _ ParameterDeclaration)* ellipsis:(_ ',' _ '...')? {
        return new AST.ParameterList(getLocation(), buildList(head, tail, 3), !!ellipsis);
    }

ParameterDeclaration
    = specifiers:DeclarationSpecifiers _ declarator:(Declarator / AbstractDeclarator)? {
        return new AST.ParameterDeclaration(getLocation(), specifiers, declarator);
    }

IdentifierList
    = head:Identifier tail:(_ ',' _ Identifier)* {
        return buildList(head, tail, 3);
    }

TypeName
    = specifierQualifiers:SpecifierQualifierList _ declarator:AbstractDeclarator? {
        return new AST.TypeName(getLocation(), specifierQualifiers, declarator)
    }

AbstractDeclarator
    = pointer:Pointer declarator:(_ DirectAbstractDeclarator)? {
        return new AST.AbstractPointerDeclarator(getLocation(), null, pointer, extractOptional(declarator, 1));
    }
    / declarator:DirectAbstractDeclarator {
        return declarator;
    }

DirectAbstractDeclarator
    = head:(
        '(' _ declarator:AbstractDeclarator _ &!')' {
            return declarator;
        }
        / element:DirectAbstractDeclaratorElement {
            return new element.type(getLocation(), null, ...element.arguments)
        }
    ) tail:(_ DirectAbstractDeclaratorElement)* {
        return extractList(tail, 1).reduce((result, element) => new element.type(element.location, result, ...element.arguments), head);
    }

// ADDED
DirectAbstractDeclaratorElement
    = '[' _ qualifiers:TypeQualifierList? _ length:AssignmentExpression? _ &!']' {
        return {
            location: getLocation(),
            type: AST.AbstractArrayDeclarator,
            arguments: [false, qualifiers || [], length, false]
        };
    }
    / '[' _ 'static' !IdentifierPart _ qualifiers:TypeQualifierList? _ length:AssignmentExpression _ &!']' {
        return {
            location: getLocation(),
            type: AST.AbstractArrayDeclarator,
            arguments: [true, qualifiers || [], length, false]
        };
    }
    / '[' _ qualifiers:TypeQualifierList _ 'static' !IdentifierPart _ length:AssignmentExpression _ &!']' {
        return {
            location: getLocation(),
            type: AST.AbstractArrayDeclarator,
            arguments: [true, qualifiers, length, false]
        };
    }
    / '[' _ '*' _ &!']' {
        return {
            location: getLocation(),
            type: AST.AbstractArrayDeclarator,
            arguments: [false, [], null, true]
        };
    }
    / '(' _ parameters:ParameterList? _ &!')' {
        return {
            location: getLocation(),
            type: AST.AbstractFunctionDeclarator,
            arguments: [parameters || new AST.ParameterList(getLocation())]
        }
    }

TypedefName
    =  identifier:Id &{ //precondition
        return isTypedefName(identifier.name);
    } {
        return new AST.TypedefName(getLocation(), identifier);
    }

Initializer
    = AssignmentExpression
    / '{' _ initializerList:InitializerList _ ','? _ &!'}' {
        return initializerList;
    }

InitializerList
    = head:InitializerListItem tail:(_ ',' _ InitializerListItem)* {
        return new AST.InitializerList(getLocation(), buildList(head, tail, 3));
    }

// ADDED
InitializerListItem
    = designators:(Designation _)? initializer:Initializer {
        return new AST.InitializerListItem(getLocation(), extractOptional(designators, 0) || [], initializer);
    }

Designation
    = designators:DesignatorList _ '=' {
        return designators;
    }

DesignatorList
    = head:Designator tail:(_ Designator)* {
        return buildList(head, tail, 1);
    }

Designator
    = '[' _ subscript:ConstantExpression _ &!']' {
        return new AST.SubscriptDesignator(getLocation(), subscript);
    }
    / '.' _ member:Identifier {
        return new AST.MemberDesignator(getLocation(), member);
    }

StaticAssertDeclaration
    = '_Static_assert' _ &!'(' _ test:ConstantExpression _ &!',' _ message:StringLiteral _ &!')' _ &!';' {
        return new AST.StaticAssertDeclaration(getLocation(), test, message);
    }

// A.2.3 Statements

// REORDER: CaseStatement, * / CompoundStatement / LabeledStatement / ExpressionStatement
Statement
    = CaseStatement
    / SelectionStatement
    / IterationStatement
    / JumpStatement
    / CompoundStatement
    / LabeledStatement
    / ExpressionStatement

// ADDED
CaseStatement
    = 'case' !IdentifierPart _ test:ConstantExpression _ &!':' _ body:Statement {
        return new AST.CaseStatement(getLocation(), test, body);
    }
    / 'default' !IdentifierPart _ &!':' _ body:Statement {
        return new AST.CaseStatement(getLocation(), null, body)
    }

// MODIFICATION: No case or default.
LabeledStatement
    = label:Identifier _ ':' _ body:Statement {
        return new AST.LabeledStatement(getLocation(), label, body);
    }

LeftBrace
    = '{' {
        enterScope();
        return getLocation();
    }

RightBrace
    = &!'}' {
        exitScope();
        return getLocation();
    }

CompoundStatement
    = left:LeftBrace _ body:BlockItemList? _ right:RightBrace {
        return new AST.CompoundStatement(getLocation(), left, right, body || []);
    }

BlockItemList
    = head:BlockItem tail:(_ BlockItem)* {
        return buildList(head, tail, 1);
    }

BlockItem
    = Statement
    / Declaration
    / Expression { // ExpressionStatementMissingSemicolon
        error('Missing \\';\\' at end of statement');
    }
    / DeclarationMissingSemicolon

ExpressionStatement
    = expression:(Expression _)? ';' {
        return expression ? new AST.ExpressionStatement(getLocation(), extractOptional(expression, 0))
                : new AST.NullStatement(getLocation());
    }

SelectionStatement
    = 'if' !IdentifierPart _ &!'(' _ test:Expression _ &!')' _ consequent:Statement alternate:(_ 'else' !IdentifierPart _ Statement)? {
        return new AST.IfStatement(getLocation(), test, consequent, extractOptional(alternate, 4));
    }
    / 'switch' !IdentifierPart _ &!'(' _ discriminant:Expression _ &!')' _ body:Statement {
        return new AST.SwitchStatement(getLocation(), discriminant, body);
    }

IterationStatement
    = 'while' !IdentifierPart _ &!'(' _ test:Expression _ &!')' _ body:Statement {
        return new AST.WhileStatement(getLocation(), test, body);
    }
    / 'do' !IdentifierPart _ body:Statement _ 'while' !IdentifierPart _ &!'(' _ test:Expression _ &!')' _ &!';' {
        return new AST.DoWhileStatement(getLocation(), body, test);
    }
    / 'for' !IdentifierPart _ &!'(' _ init:(Declaration / expression:Expression? _ ';' {
        return expression;
    } / (DeclarationWithoutSemicolon / Expression) {
        error('Missing \\';\\'');
    }) _ test:Expression? _ &!';' _ update:Expression? _ &!')' _ body:Statement {
        return new AST.ForStatement(getLocation(), init, test, update, body);
    }

JumpStatement
    = 'goto' !IdentifierPart _ label:Identifier _ &!';' {
        return new AST.GotoStatement(getLocation(), label);
    }
    / 'continue' !IdentifierPart _ &!';' {
        return new AST.ContinueStatement(getLocation());
    }
    / 'break' !IdentifierPart _ &!';' {
        return new AST.BreakStatement(getLocation());
    }
    / 'return' !IdentifierPart _ argument:Expression? _ &!';' {
        return new AST.ReturnStatement(getLocation(), argument);
    }

// A.2.4 External definitions

TranslationUnit
    = _ head:ExternalDeclaration tail:(_ ExternalDeclaration)* _ {
        return new AST.TranslationUnit(getLocation(), buildList(head, tail, 1));
    }

// REORDER: Declaration / FunctionDefinition (Don't know if necessary)
ExternalDeclaration
    = Declaration
    / FunctionDefinition
    / DeclarationMissingSemicolon

FunctionDefinition 'function definition'
    = specifiers:DeclarationSpecifiers _ declarator:Declarator _ declarations:DeclarationList? _ body:CompoundStatement {
        return new AST.FunctionDefinition(getLocation(), specifiers, declarator, declarations, body);
    }

DeclarationList
    = head:Declaration tail:(_ Declaration)* {
        return buildList(head, tail, 1);
    }
TryBlock
    = 'try' _ body:CompoundStatement _ handlers:HandlerSeq {
        return new AST.TryBlock(getLocation(), body, handlers);
    }
    
HandlerSeq
    = head:ExceptionHandler tail:(_ ExceptionHandler)* {
        return buildList(head, tail, 1);
    }
    
ExceptionHandler
    = 'catch' _ '(' _ decl:ExceptionDeclaration _ ')' _ body:CompoundStatement {
        return new AST.ExceptionHandler(getLocation(), decl, body);
    }
    
ExceptionDeclaration 
 	= specifiers:DeclarationSpecifiers _ declarator:Declarator {
 	    return new AST.ExceptionDeclaration(getLocation(), specifiers, declarator);
 	}
 	/ specifiers:DeclarationSpecifiers _ declarator:AbstractDeclarator {
 	    return new AST.ExceptionDeclaration(getLocation(), specifiers, declarator);
 	}
 	
ThrowExpression 
 	= 'throw' _ body:AssignmentExpression? {
 	    return new AST.ThrowExpression(getLocation(), body);
 	}
// A.3 Preprocessing directives
`