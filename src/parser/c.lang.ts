/* tslint:disable */
// generate from resource/grammar        
export default `{
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

    let scopeRoot = { parent: null, names: new Map() };
    let currScope = scopeRoot;

    function enterScope() {
        currScope = { parent: currScope, names: new Map() };
    }

    function exitScope() {
        currScope = currScope.parent;
    }

    let ID_NAME = 0;
    let TYPE_NAME = 1;
    let TEMPLATE_FUNC_NAME = 2;
    let TEMPLATE_CLASS_NAME = 3;

    function getTypeOfName(name, type) {
        let c = currScope;
        while(c != null) {
            if (c.names.has(name)) {
                return c.names.get(name);
            }
            c = c.parent;
        }
        return ID_NAME;
    }
}
Start = TranslationUnit
ClassSpecifier
    = classKey:ClassKeyword _ identifier:TypeDeclarationIdentifier _ ih:BaseClause? _ ScopeStart _ declarations:StructDeclarationList? _ ScopeEnd {
        return new AST.ClassSpecifier(getLocation(), classKey, identifier, declarations || [] , ih || []);
    }
    / classKey:ClassKeyword _ identifier:TypeDeclarationIdentifier {
        return new AST.ClassSpecifier(getLocation(), classKey, identifier, null, []);
    }

ClassKeyword
    = ('struct' / 'class' / 'union') !IdentifierPart {
        return text();
    }

BaseSpecifier
    = lb:AccessControlKey? _ className:TypeIdentifier{
        return new AST.BaseSpecifier(getLocation(), lb || "", className);
    }

BaseClause
    = ':' _ head:BaseSpecifier tail:(_ ',' _ BaseSpecifier)* {
        return buildList(head, tail, 1);
    }

StructDeclarationList
    = head:StructDeclaration tail:(_ StructDeclaration)* {
        return buildList(head, tail, 1);
    }

AccessControlKey = 'public' / 'private' / 'protect'

StructDeclaration
    = id:TypeIdentifier _ '(' _ param:ParameterList? _ ')' _ initList:ConstructorInitializeList? _ body:CompoundStatement{
        return new AST.ConstructorDeclaration(getLocation(), id, param, initList || [], body);
    }
    / id:TypeIdentifier _ '(' _ param:ParameterList? _ ')' _ initList:ConstructorInitializeList? _ ';'{
        return new AST.ConstructorDeclaration(getLocation(), id, param, initList || [], nul);
    }
    / isVirtual:'virtual'? _ '~' id:TypeIdentifier _ '(' _ ')' _ body:CompoundStatement{
        return new AST.DestructorDeclaration(getLocation(), id, body, isVirtual === "virtual");
    }
    / isVirtual:'virtual'? _ '~' id:TypeIdentifier _ '(' _ ')' _ ';'{
        return new AST.DestructorDeclaration(getLocation(), id, null, isVirtual === "virtual");
    }
    / label:AccessControlKey _ ':' {
        return new AST.AccessControlLabel(getLocation(), label);
    }
    / decl:Declaration {
        return decl;
    }

ConstructorInitializeList
    = ':' _ head:ConstructorInitializeItem _ tail:(_ ',' _ ConstructorInitializeItem)* {
         return buildList(head, tail, 3);
    }

ConstructorInitializeItem
    = key:Identifier _ '(' _ value:ArgumentExpressionList _ ')' {
        return new AST.ConstructorInitializeItem(getLocation(), key, value, false);
    }
    / key:TypeIdentifier _ '(' _ value:ArgumentExpressionList _ ')' {
        return new AST.ConstructorInitializeItem(getLocation(), key, value, true);
    }

SpecifierQualifierList
    = head:SpecifierQualifier tail:(_ SpecifierQualifier)* {
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

FloatingConstant
    = DecimalFloatingConstant

DecimalFloatingConstant
    = raw:$((FractionalConstant ExponentPart?) / (DigitSequence ExponentPart)) suffix:$FloatingSuffix? {
        return new AST.FloatingConstant(getLocation(), Number.parseFloat(raw), raw, suffix || null);
    }

HexadecimalFractionalConstant
    = HexadecimalDigitSequence '.' HexadecimalDigitSequence?
    / '.' HexadecimalDigitSequence

CharacterConstant
    = prefix:$[LuU]? '\\'' value:CCharSequence '\\'' {
        return new AST.CharacterConstant(getLocation(), value, prefix || null);
    }

EncodingPrefix
    = 'u8'
    / 'u'
    / 'U'
    / 'L'

UniversalCharacterName
    = '\\\\u' hexQuad:$HexQuad {
        return parseUniversalCharacter(hexQuad);
    }
    / '\\\\U' hexQuads:$(HexQuad HexQuad) {
        return parseUniversalCharacter(hexQuads);
    }

HexQuad
    = HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit

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

SingleStringLiteral
    = prefix:$EncodingPrefix? '"' value:SCharSequence? &!'"' {
        return new AST.StringLiteral(getLocation(), prefix || null, (value || '') + '\\0');
    }

SCharSequence
    = chars:SChar+ {
        return chars.join('');
    }

SChar
    = [^"\\\\\\n] // any member of the source character set except the double-quote ", backslash \\, or new-line character
    / EscapeSequence

UnaryOperator
    = [*+\\-~!]
    / SingleAnd

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

BinaryExponentPart
    = [pP] Sign? DigitSequence

HexadecimalDigitSequence
    = HexadecimalDigit+

FloatingSuffix
    = [flFL]

FractionalConstant
    = DigitSequence '.' DigitSequence?
    / '.' DigitSequence

ExponentPart
    = [eE] Sign? DigitSequence

Sign
    = [+\\-]

DigitSequence
    = Digit+

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
Expression
    = head:AssignmentExpression tail:(_ ',' _ AssignmentExpression)* {
        return buildBinaryExpression(head, tail);
    }

AssignmentExpression
    = left:UnaryExpression _ operator:AssignmentOperator _ right:AssignmentExpression {
        return new AST.AssignmentExpression(getLocation(), operator, left, right);
    }
    / ConditionalExpression

ConditionalExpression
    = test:LogicalOrExpression _ '?' _ consequent:Expression _ &!':' _ alternate:ConditionalExpression {
        return new AST.ConditionalExpression(getLocation(), test, consequent, alternate);
    }
    / LogicalOrExpression


ConstructorCallExpression
    = name:TypeIdentifier  _ '(' _ arguments_:ArgumentExpressionList? _ &!')' {
        return new AST.ConstructorCallExpression(getLocation(), name, arguments_ || []);
    }

PostfixExpression
    = head:( PrimaryExpression / ConstructorCallExpression ) tail:(_ (
        '[' _ subscript:Expression _ &!']' {
            return {
                type: AST.SubscriptExpression,
                arguments: [subscript]
            };
        }
        / '(' _ arguments_:ArgumentExpressionList? _ ')' {
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
    / operator:'sizeof' _ '(' _ operand:TypeName _ ')' {
        return new AST.UnaryExpression(getLocation(), operator, operand);
    }
    / PostfixExpression
    / NewExpression
    / DeleteExpression

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

ConstantExpression
    = ConditionalExpression

PrimaryExpression
    = Identifier
    / Constant
    / StringLiteral
    / '(' _ expression:Expression _ &!')' {
        return expression;
    }



NewPlacement
    = '(' _  item:AssignmentExpression _ ')' {
        return item;
    }

NewInitializer
    = '(' _ arguments_:ArgumentExpressionList? _ ')' {
        return arguments_;
    }

NewExpression
    = '::'? 'new' !IdentifierPart _ placement:NewPlacement? _ type:NewTypeName _ initializer:NewInitializer?{
        return new AST.NewExpression(getLocation(), type, initializer || [], placement || null);
    }
    / '::'? 'new' !IdentifierPart _ placement:NewPlacement? _ '(' _ name:TypeName _ ')' _ initializer:NewInitializer?{
        return new AST.NewExpression(getLocation(), type, initializer || [], placement || null);
    }

DeleteExpression
    = 'delete' _ expr:AssignmentExpression {
        return new AST.DeleteExpression(getLocation(), expr, false);
    }
    / 'delete[]' _ expr:AssignmentExpression {
        return new AST.DeleteExpression(getLocation(), expr, true);
    }
TranslationUnit
    = list:DeclarationList{
        return new AST.TranslationUnit(getLocation(), list);
    }

DeclarationList
    = _ head:Declaration tail:(_ Declaration)* _ {
        return buildList(head, tail, 1);
    }

Declaration
    = BlockDeclaration
    / FunctionDefinition
    / NamespaceDefinition
    / TemplateDeclaration
    / ExplicitInstantiation
    / DeclarationMissingSemicolon

BlockDeclaration
    = SimpleDeclaration
    / UsingStatements

BlockDeclarationList
    = head:BlockDeclaration tail:(_ BlockDeclaration)*{
        return buildList(head, tail, 1);
    }

NamespaceDefinition
    = 'namespace' _ name:SingleIdentifier _ '{' _ list:DeclarationList? _'}'{
        currScope.names.set(name.name, TYPE_NAME);
        return new AST.NameSpaceBlock(getLocation(), name, list || []);
    }

SimpleDeclaration
    = specifiers:DeclarationSpecifiers _ initDeclarators:InitDeclaratorList? _ ';' {
        const declaration = new AST.Declaration(getLocation(), specifiers, initDeclarators || []);
        declaration.getTypedefName().map(name => currScope.names.set(name, TYPE_NAME));
        return declaration;
    }

DeclarationSpecifiers
    = head:DeclarationSpecifier tail:(_ DeclarationSpecifier)* {
        return new AST.SpecifierList(getLocation(), buildList(head, tail, 1));
    }

DeclarationSpecifier
    = StorageClassSpecifier
    / FunctionSpecifier
    / TypeSpecifier

TypeSpecifierList
    = head:TypeSpecifier tail:( _ TypeSpecifier)* {
        return buildList(head, tail, 3);
    }

TypeSpecifier
    = ClassSpecifier
    / EnumSpecifier
    / SimpleTypeSpecifier
    / TypenameSpecifier
    / TypeQualifier

SimpleTypeSpecifier
    = PrimitiveTypeSpecifier
    / TypeIdentifier

TypenameSpecifier
    = 'typename' id:TypeIdentifier{
        return id;
    }

TypeQualifier
    = ('const' / 'volatile') !IdentifierPart {
        return text();
    }

TypeQualifierList
    = head:TypeQualifier tail:(_ TypeQualifier)* {
        return buildList(head, tail, 1);
    }

Declarator
    = pointer:(Pointer _)? declarator:DirectDeclarator {
        return pointer ? new AST.PointerDeclarator(getLocation(), declarator, extractOptional(pointer, 0)) : declarator;
    }

DirectDeclarator
    = head:(identifier:Identifier {
        return new AST.IdentifierDeclarator(getLocation(), identifier);
    } / '(' _ declarator:Declarator _ ')' {
        return declarator;
    } ) tail:(_ (
        '[' _ length:AssignmentExpression? _ &!']' {
            return {
                location: getLocation(),
                type: AST.ArrayDeclarator,
                arguments: [false, [], length, false]
            };
        }
        / '(' _ parameters: ParameterList? _ ')' {
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

DeclarationWithoutSemicolon
    = specifiers:DeclarationSpecifiers _ initDeclarators:InitDeclaratorList?

DeclarationMissingSemicolon
    = decl:DeclarationWithoutSemicolon {
        error('Missing \\';\\' at end of declaration');
    }

FunctionSpecifier = ('inline' / '__libcall')

InitDeclaratorList
    = head:InitDeclarator tail:(_ ',' _ InitDeclarator)* {
        return buildList(head, tail, 3);
    }

InitDeclarator
    = declarator:Declarator initializer:CppInitializer? {
        return new AST.InitDeclarator(getLocation(), declarator, initializer || null);
    }
    
CppInitializer
    = _'=' _ init:Initializer{
        return init;
    }
    / _ '(' _ arguments_:ArgumentExpressionList? _ ')' {
        return new AST.ObjectInitializer(getLocation(),  arguments_ || []);  
    }


ParameterList
    = head:ParameterDeclaration tail:(_ ',' _ ParameterDeclaration)* ellipsis:(_ ',' _ '...')? {
        return new AST.ParameterList(getLocation(), buildList(head, tail, 3), !!ellipsis);
    }

ParameterDeclaration
    = specifiers:DeclarationSpecifiers _ declarator:(Declarator / AbstractDeclarator)? init:( _ '=' _ AssignmentExpression)?{
        return new AST.ParameterDeclaration(getLocation(), specifiers, declarator, init ? init[3] : null);
    }

IdentifierList
    = head:Identifier tail:(_ ',' _ Identifier)* {
        return buildList(head, tail, 3);
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

InitializerListItem
    = designators:(Designation _)? initializer:Initializer {
        return new AST.InitializerListItem(getLocation(), initializer);
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

FunctionDefinition
    = specifiers:DeclarationSpecifiers _ declarator:Declarator _ body:CompoundStatement {
        return new AST.FunctionDefinition(getLocation(), specifiers, declarator, body);
    }

NewTypeName
    =  specifierQualifiers:SpecifierQualifierList _ declarator:NewDeclarator? {
        return new AST.TypeName(getLocation(), specifierQualifiers, declarator)
    }

TypeName
    = specifierQualifiers:SpecifierQualifierList _ declarator:AbstractDeclarator? {
        return new AST.TypeName(getLocation(), specifierQualifiers, declarator)
    }

NewDeclarator
    = pointer:Pointer declarator:(_ DirectNewDeclarator)? {
        return new AST.AbstractPointerDeclarator(getLocation(), null, pointer, extractOptional(declarator, 1));
    }
    / declarator:DirectNewDeclarator {
        return declarator;
    }

AbstractDeclarator
    = pointer:Pointer declarator:(_ DirectAbstractDeclarator)? {
        return new AST.AbstractPointerDeclarator(getLocation(), null, pointer, extractOptional(declarator, 1));
    }
    / declarator:DirectAbstractDeclarator {
        return declarator;
    }

DirectNewDeclarator
    = head:(element:DirectNewDeclaratorElement {
            return new element.type(getLocation(), null, ...element.arguments)
        }
    ) tail:(_ DirectNewDeclaratorElement)* {
        return extractList(tail, 1).reduce((result, element) => new element.type(element.location, result, ...element.arguments), head);
    }

DirectAbstractDeclarator
    = head:(
        '(' _ declarator:AbstractDeclarator _ ')' {
            return declarator;
        }
        / element:DirectAbstractDeclaratorElement {
            return new element.type(getLocation(), null, ...element.arguments)
        }
    ) tail:(_ DirectAbstractDeclaratorElement)* {
        return extractList(tail, 1).reduce((result, element) => new element.type(element.location, result, ...element.arguments), head);
    }

DirectNewDeclaratorElement
    = '[' _ length:AssignmentExpression? _ &!']' {
        return {
            location: getLocation(),
            type: AST.AbstractArrayDeclarator,
            arguments: [false, [], length, false]
        };
    }

DirectAbstractDeclaratorElement
    = '(' _ parameters:ParameterList? _ ')' {
        return {
            location: getLocation(),
            type: AST.AbstractFunctionDeclarator,
            arguments: [parameters || new AST.ParameterList(getLocation())]
        }
    }
    / DirectNewDeclaratorElement
Id
    = !Keyword head:IdentifierNondigit tail:IdentifierPart* {
        return new AST.SingleIdentifier(getLocation(), head + tail.join(''), AST.IDType.ID, []);
    }

SingleIdentifier
    = id:Id &{
        return getTypeOfName(id.name) === ID_NAME;
    } {
        return id;
    }
    / 'operator' ope:OverloadOperator {
        return new AST.SingleIdentifier(getLocation(), "#" + ope, AST.IDType.ID, []);
    }
    / '~' name:TypeIdentifier {
        const result = name.clone();
        result.getLastID().name = '~' + result.identifier.name;
        result.getLastID().type = AST.IDType.TYPE;
        return result;
    }

SingleTypeIdentifier
    =  id:Id &{
        return getTypeOfName(id.name) === TYPE_NAME;
    } {
        id.type = AST.IDType.TYPE;
        return id;
    }
    / id:TemplateClassInstanceIdentifier{
        return id;
    }

SingleTemplateFuncIdentifier
    =  id:Id &{
        return getTypeOfName(id.name) === TEMPLATE_FUNC_NAME;
    } {
        id.type = AST.IDType.T_FUNC;
        return id;
    }

SingleTemplateClassIdentifier
    =  id:Id &{
        return getTypeOfName(id.name) === TEMPLATE_CLASS_NAME;
    } {
        id.type = AST.IDType.T_CLASS;
        return id;
    }

Identifier
    = isFullName:'::'? namespace:(SingleTypeIdentifier '::')* name:(SingleIdentifier/TemplateFuncInstanceIdentifier) {
        return new AST.Identifier(getLocation(), namespace.map(x=>x[0]).concat([name]), isFullName);
    }

TypeIdentifier
    = isFullName:'::'? namespace:(SingleTypeIdentifier '::')* name:(SingleTypeIdentifier/TemplateClassInstanceIdentifier) {
        return new AST.Identifier(getLocation(), namespace.map(x=>x[0]).concat([name]), isFullName);
    }

TemplateFuncIdentifier
    = isFullName:'::'? namespace:(SingleTypeIdentifier '::')* name:SingleTemplateFuncIdentifier {
        return new AST.Identifier(getLocation(), namespace.map(x=>x[0]).concat([name]), isFullName);
    }

TemplateClassIdentifier
    = isFullName:'::'? namespace:(SingleTypeIdentifier '::')* name:SingleTemplateClassIdentifier {
        return new AST.Identifier(getLocation(), namespace.map(x=>x[0]).concat([name]), isFullName);
    }

TypeDeclarationIdentifier
    = identifier:Identifier{
        if( options.isCpp ) { currScope.names.set(identifier.getLastID().name, TYPE_NAME); }
        return identifier;
    }

WhiteSpace = [ \\t\\n\\v\\f]

_ = WhiteSpace*

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
    / 'class'
    / 'new'
    / 'delete'
    / 'operator'
    / 'override'
    / 'template'
    / 'typename'
    / 'namespace'
    / 'using') !IdentifierPart

StorageClassSpecifier
    = ('typedef'
    / 'extern'
    / 'static'
    / 'virtual'
    / 'auto'
    / 'register') !IdentifierPart {
        return text();
    }

PrimitiveTypeSpecifier
    = ('void'
    / 'char'
    / 'short'
    / 'int'
    / 'long'
    / 'float'
    / 'double'
    / 'signed'
    / 'unsigned'
    / 'bool') !IdentifierPart {
        return text();
     }

OverloadOperator
    = '+' / '-' / '*' / '/' / '%' / '&' / '<' / '>' / '<=' / '>=' / '==' / '!='
    / '|' / '^' / '!' / '~' / '&&' / '||' / '>>' / '<<' / '++' / '--'
    /'()' / '[]' / '->'
    / AssignmentOperator

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

AndAnd
    = '&&'

SingleAnd
    = '&'!'&'

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

IdentifierPart
    = IdentifierNondigit
    / Digit

IdentifierNondigit
    = UniversalCharacterName
    / Nondigit

Nondigit
    = [_a-zA-Z]

Digit
    = [0-9]

Statement
    = CaseStatement
    / SelectionStatement
    / IterationStatement
    / JumpStatement
    / CompoundStatement
    / LabeledStatement
    / ExpressionStatement
    / UsingStatements

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

ScopeStart
    = '{' {
        enterScope();
        return getLocation();
    }

ScopeEnd
    = &!'}' {
        exitScope();
        return getLocation();
    }

CompoundStatement
    = left:ScopeStart _ body:BlockItemList? _ right:ScopeEnd {
        return new AST.CompoundStatement(getLocation(), body || []);
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


UsingStatements
    = 'using' _ name:SingleIdentifier _ '=' _ decl:TypeName _ ';'{
        currScope.names.set(name.name, TYPE_NAME);
        return new AST.UsingStatement(getLocation(), name, decl);
    }
    / 'using' _ name:(Identifier/TypeIdentifier/TemplateClassIdentifier/TemplateFuncIdentifier) _ ';'{
        return new AST.UsingItemStatement(getLocation(), name);
    }
    / 'using' _ 'namespace' _ name:TypeIdentifier _ ';'{
        return new AST.UsingNamespaceStatement(getLocation(), name);
    }
TemplateDeclaration
    = 'template' _ '<' _ &{
        enterScope();
        return true;
    } param:TemplateParameterList? _ &!'>' _ decl:(ClassSpecifierWithSemi/FunctionDefinition) {
        exitScope();
        const result = new AST.TemplateDeclaration(getLocation(), decl, param || []);
        const names = result.getTemplateNames();
        const typeId = (decl instanceof AST.FunctionDefinition) ? TEMPLATE_FUNC_NAME : TEMPLATE_CLASS_NAME;
        names.map(name => currScope.names.set(name, typeId));
        return result;
    }

ClassSpecifierWithSemi
    = id:ClassSpecifier _ ';' {
        return id;
    }

TemplateParameterList
    = head:TemplateParameter tail:(_ ',' _ TemplateParameter)* {
        return buildList(head, tail, 3);
    }

TemplateParameter
    = TypeParameter
    / ParameterDeclaration;

TypeNameKeyword = 'class' / 'typename'

// TODO:: identifier is optional?
TypeParameter
    = TypeNameKeyword _ id:TypeDeclarationIdentifier init:( _ '=' _ TypeName)? {
        return new AST.TypeParameter(getLocation(), id, init ? init[3] : null);
    }

TemplateFuncInstanceIdentifier
    = id:SingleTemplateFuncIdentifier opt:(_ '<' _ TemplateArgumentList? _ &!'>' _ )? {
        id.type = AST.IDType.T_FUNC_INS;
        id.args = opt ? (opt[3] || []) : [];
        return id;
    }

TemplateClassInstanceIdentifier
    = id:SingleTemplateClassIdentifier opt:(_ '<' _ TemplateArgumentList? _ &!'>' _ )? {
        id.type = AST.IDType.T_CLASS_INS;
        id = opt ? (opt[3] || []) : [];
        return id;
    }

TemplateArgumentList
    = head:TemplateArgument tail:(_ ',' _ TemplateArgument)* {
        return buildList(head, tail, 3);
    }

TemplateArgument
    = item:TypeName {
        return new TemplateArgument(getLocation(), item);
    }
    / item:AdditiveExpression {
        return new TemplateArgument(getLocation(), item);
    }

ExplicitInstantiation
    = FunctionTemplateInstantiation

FunctionTemplateInstantiation
    = 'template' _ specifiers:DeclarationSpecifiers _ declarator:Declarator _ ';'{
        return new AST.FunctionTemplateInstantiation(getLocation(), specifiers, declarator);
    }`        
