import * as Long from 'long';
import {CompileContext} from "../codegen/context";
import {Type} from "./type";
import {FunctionEntity} from "../codegen/scope";

export type SpecifierType = string|AtomicTypeSpecifier|StructOrUnionSpecifier|EnumSpecifier|TypedefName|AlignmentSpecifier;
export enum ExpressionResultType{
    CONSTANT,                       // value => constant
    LVALUE_STACK,                   // value => bp_offset
    LVALUE_MEMORY_DATA,             // value => data_offset
    LVALUE_MEMORY_BSS,              // value => bss_offset
    LVALUE_MEMORY_EXTERN,           // value => string
    RVALUE,                         // value => 0, pos => stack_top
}

export interface ExpressionResult {
    type: Type;
    form: ExpressionResultType;
    value: Long | number | string;
    isConst?: boolean;
}


export class Position {
    offset: number;
    line: number;
    column: number;
    constructor(offset: number, line: number, column: number) {
        this.offset = offset;
        this.line = line;
        this.column = column;
    }
    toString(){
        return `(${this.line}:${this.column})`
    }
}
export class SourceLocation {
    source: string;
    start: Position;
    end: Position;
    constructor(source: string, start: Position, end: Position) {
        this.source = source;
        this.start = start;
        this.end = end;
    }
    toString() {
        return `${this.start.line}(${this.start.column}) - ${this.end.line}(${this.end.column})`;
    }
}
export abstract class Node {
    location: SourceLocation;
    parentNode: Node | null;
    protected constructor(location: SourceLocation) {
        this.location = location;
        this.parentNode = null;
    }
    codegen(ctx: CompileContext): any{
        throw "no_impl at " + this.constructor.name;
    }
}
export class Comment extends Node {
    value: string;
    constructor(location: SourceLocation, value: string) {
        super(location);
        this.value = value;
    }
}
export class MultiLineComment extends Comment {
    constructor(location: SourceLocation, value: string) {
        super(location, value);
    }
}
export class SingleLineComment extends Comment {
    constructor(location: SourceLocation, value: string) {
        super(location, value);
    }
}
export class PpChar extends Node {
    value: string;
    constructor(location: SourceLocation, value: string) {
        super(location);
        this.value = value;
    }
}
export class Expression extends Node {
    constructor(location: SourceLocation) {
        super(location);
    }
    codegen(ctx: CompileContext): ExpressionResult {
        return super.codegen(ctx);
    }
    deduceType(ctx: CompileContext): Type {
        throw 0;
    }
}
export class Identifier extends Expression {
    name: string;
    mangledName: string | null;
    constructor(location: SourceLocation, name: string) {
        super(location);
        this.name = name;
        this.mangledName = null; //如果访问static变量，这里是mangledName，格式是name.Symbol(scopeName)
    }
    get value() { //alias
        return this.name;
    }
}
export class Constant extends Expression {
    constructor(location: SourceLocation) {
        super(location);
    }
}
export class IntegerConstant extends Constant {
    base: number;
    value: Long;
    raw: string;
    suffix: string|null;
    constructor(location: SourceLocation, base: number, value: Long, raw: string, suffix: string|null) {
        super(location);
        this.base = base;
        this.value = value;
        this.raw = raw;
        this.suffix = suffix;
    }
}
export class FloatingConstant extends Constant {
    value: number;
    raw: string;
    suffix: string|null;
    constructor(location: SourceLocation, value: number, raw: string, suffix: string|null) {
        super(location);
        this.value = value;
        this.raw = raw;
        this.suffix = suffix;
    }
}
export class CharacterConstant extends Constant {
    value: string;
    prefix: string|null;
    constructor(location: SourceLocation, value: string, prefix: string|null) {
        super(location);
        this.value = value;
        this.prefix = prefix;
    }
}
export class StringLiteral extends Expression {
    prefix: string|null;
    value: string;
    constructor(location: SourceLocation, prefix: string|null, value: string) {
        super(location);
        this.prefix = prefix;
        this.value = value;
    }
}
export class Punctuator extends Node {
    value: string;
    constructor(location: SourceLocation, value: string) {
        super(location);
        this.value = value;
    }
}
export class HeaderName extends Node {
    name: string;
    quoted: boolean;
    constructor(location: SourceLocation, name: string, quoted: boolean) {
        super(location);
        this.name = name;
        this.quoted = quoted;
    }
}
export class PpNumber extends Node {
    raw: string;
    constructor(location: SourceLocation, raw: string) {
        super(location);
        this.raw = raw;
    }
    get value() { //alias
        return this.raw;
    }
}
export class ParenthesisExpression extends Expression {
    expression: Expression;
    constructor(location: SourceLocation, expression: Expression) {
        super(location);
        this.expression = expression;
    }
}
export class GenericAssociation extends Node {
    test: TypeName|null;
    consequent: Expression;
    constructor(location: SourceLocation, test: TypeName|null, consequent: Expression) {
        super(location);
        this.test = test;
        this.consequent = consequent;
    }
}
export class GenericSelection extends Expression {
    discriminant: Expression;
    associations: GenericAssociation[];
    constructor(location: SourceLocation, discriminant: Expression, associations: GenericAssociation[]) {
        super(location);
        this.discriminant = discriminant;
        this.associations = associations;
    }
}
export class CompoundLiteral extends Expression {
    typeName: TypeName;
    initializerList: InitializerList;
    constructor(location: SourceLocation, typeName: TypeName, initializerList: InitializerList) {
        super(location);
        this.typeName = typeName;
        this.initializerList = initializerList;
    }
}
export class SubscriptExpression extends Expression {
    array: Expression;
    subscript: Expression;
    constructor(location: SourceLocation, array: Expression, subscript: Expression) {
        super(location);
        this.array = array;
        this.subscript = subscript;
    }
}
export class CallExpression extends Expression {
    callee: Expression;
    arguments: Expression[];
    constructor(location: SourceLocation, callee: Expression, arguments_: Expression[]) {
        super(location);
        this.callee = callee;
        this.arguments = arguments_;
    }
}
export class MemberExpression extends Expression {
    object: Expression;
    pointed: boolean;
    member: Identifier;
    offset: number;
    size:0;
    constructor(location: SourceLocation, object: Expression, pointed: boolean, member: Identifier) {
        super(location);
        this.object = object;
        this.pointed = pointed;
        this.member = member;
        this.offset = 0;
        this.size = 0;
    }
}
export class PostfixExpression extends Expression {
    operand: Expression;
    decrement: boolean;
    constructor(location: SourceLocation, operand: Expression, decrement: boolean) {
        super(location);
        this.operand = operand;
        this.decrement = decrement;
    }
}
export class UnaryExpression extends Expression {
    operator: string; // ++, --, sizeof, *, +, -, !, ~
    operand: Expression;
    constructor(location: SourceLocation, operator: string, operand: Expression) {
        super(location);
        this.operator = operator;
        this.operand = operand;
    }
}
export class CastExpression extends Expression {
    typeName: TypeName;
    operand: Expression;
    constructor(location: SourceLocation, typeName: TypeName, operand: Expression) {
        super(location);
        this.typeName = typeName;
        this.operand = operand;
    }
}
export class BinaryExpression extends Expression {
    operator: string;
    // + - * / % & | && || < > <= >= == !=
    left: Expression;
    right: Expression;
    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        if (typeof operator[1] === 'undefined') { //HACK: for rule '&'!'&' this will receive ["&", undefined]
            this.operator = operator[0];
        } else {
            this.operator = operator;
        }
        this.left = left;
        this.right = right;
    }
}
export class ConditionalExpression extends Expression {
    test: Expression;
    consequent: Expression;
    alternate: Expression;
    constructor(location: SourceLocation, test: Expression, consequent: Expression, alternate: Expression) {
        super(location);
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }
}
export class AssignmentExpression extends Expression {
    operator: string;
    left: Expression;
    right: Expression;
    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
}
export class Declaration extends Node {
    specifiers: SpecifierType[];
    initDeclarators: InitDeclarator[];
    isStatic: boolean;
    isTypedef: boolean;
    constructor(location: SourceLocation, specifiers: SpecifierType[], initDeclarators: InitDeclarator[]) {
        super(location);
        this.specifiers = specifiers;
        this.initDeclarators = initDeclarators;
        this.isStatic = false; //set in syntax-check
        this.isTypedef = false; //set in syntax-check
    }
}
export class AtomicTypeSpecifier extends Node {
    typeName: TypeName;
    constructor(location: SourceLocation, typeName: TypeName) {
        super(location);
        this.typeName = typeName;
    }
}
export class StructOrUnionSpecifier extends Node {
    union: boolean;
    identifier: Identifier;
    declarations: StructDeclaration[]|null;
    constructor(location: SourceLocation, union: boolean, identifier: Identifier, declarations: StructDeclaration[]|null) {
        super(location);
        this.union = union;
        this.identifier = identifier;
        this.declarations = declarations;
    }
}
export class StructDeclaration extends Node {
    specifierQualifiers: (string|AtomicTypeSpecifier|StructOrUnionSpecifier|EnumSpecifier|TypedefName)[];
    declarators: StructDeclarator[];
    constructor(location: SourceLocation, specifierQualifiers: (string|AtomicTypeSpecifier|StructOrUnionSpecifier|EnumSpecifier|TypedefName)[], declarators: StructDeclarator[]) {
        super(location);
        this.specifierQualifiers = specifierQualifiers;
        this.declarators = declarators;
    }
}
export class StructDeclarator extends Node {
    declarator: Declarator|null;
    width: Expression|null;
    constructor(location: SourceLocation, declarator: Declarator|null, width: Expression|null) {
        super(location);
        this.declarator = declarator;
        this.width = width;
    }
}
export class EnumSpecifier extends Node {
    identifier: Identifier;
    enumerators: Enumerator[]|null;
    constructor(location: SourceLocation, identifier: Identifier, enumerators: Enumerator[]|null) {
        super(location);
        this.identifier = identifier;
        this.enumerators = enumerators;
    }
}
export class Enumerator extends Node {
    identifier: Identifier;
    value: Expression|null;
    constructor(location: SourceLocation, identifier: Identifier, value: Expression|null) {
        super(location);
        this.identifier = identifier;
        this.value = value;
    }
}
export class TypedefName extends Node {
    identifier: Identifier;
    constructor(location: SourceLocation, identifier: Identifier) {
        super(location);
        this.identifier = identifier;
    }
}
export class AlignmentSpecifier extends Node {
    alignment: TypeName|Expression;
    constructor(location: SourceLocation, alignment: TypeName|Expression) {
        super(location);
        this.alignment = alignment;
    }
}
export class InitDeclarator extends Node {
    declarator: Declarator;
    initializer: Expression|InitializerList|null;
    isObjectDeclarator: boolean;
    constructor(location: SourceLocation, declarator: Declarator, initializer: Expression|InitializerList|null) {
        super(location);
        this.declarator = declarator;
        this.initializer = initializer;
        this.isObjectDeclarator = true; //not function, set in syntax-check
    }
}
export class StaticAssertDeclaration extends Declaration {
    test: Expression;
    message: StringLiteral;
    constructor(location: SourceLocation, test: Expression, message: StringLiteral) {
        super(location, [], []);
        this.test = test;
        this.message = message;
    }
}
export class Declarator extends Node {
    declarator: Declarator | null;
    constructor(location: SourceLocation, declarator: Declarator | null) {
        super(location);
        this.declarator = declarator;
    }
}
export class PointerDeclarator extends Declarator {
    pointer: Pointer;
    constructor(location: SourceLocation, declarator: Declarator, pointer: Pointer) {
        super(location, declarator);
        this.pointer = pointer;
    }
}
export class Pointer extends Node {
    qualifiers: string[];
    pointer: Pointer|null;
    constructor(location: SourceLocation, qualifiers: string[], pointer: Pointer|null) {
        super(location);
        this.qualifiers = qualifiers;
        this.pointer = pointer;
    }
}
export class IdentifierDeclarator extends Declarator {
    identifier: Identifier;
    constructor(location: SourceLocation, identifier: Identifier) {
        super(location, null);
        this.identifier = identifier;
    }
}
export class ArrayDeclarator extends Declarator {
    static: boolean;
    qualifiers: string[];
    length: Expression;
    variableLength: boolean;
    constructor(location: SourceLocation, declarator: Declarator, static_: boolean, qualifiers: string[], length: Expression, variableLength: boolean) {
        super(location, declarator);
        this.static = static_;
        this.qualifiers = qualifiers;
        this.length = length;
        this.variableLength = variableLength;
    }
}
export class FunctionDeclarator extends Declarator {
    parameters: ParameterList|Identifier[];
    constructor(location: SourceLocation, declarator: Declarator, parameters: ParameterList|Identifier[]) {
        super(location, declarator);
        this.parameters = parameters;
    }
}
export class ParameterList extends Node {
    parameters: ParameterDeclaration[];
    variableArguments: boolean;
    constructor(location: SourceLocation, parameters: ParameterDeclaration[] = [], variableArguments: boolean = false) {
        super(location);
        this.parameters = parameters;
        this.variableArguments = variableArguments;
    }
}
export class ParameterDeclaration extends Node {
    specifiers: SpecifierType[];
    declarator: Declarator|AbstractDeclarator|null;
    constructor(location: SourceLocation, specifiers: SpecifierType[], declarator: Declarator|AbstractDeclarator|null) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
    }
}
export class TypeName extends Node {
    specifierQualifiers: SpecifierType[];
    declarator: AbstractDeclarator|null;
    constructor(location: SourceLocation, specifierQualifiers: SpecifierType[], declarator: AbstractDeclarator|null) {
        super(location);
        this.specifierQualifiers = specifierQualifiers;
        this.declarator = declarator;
    }
}
export class AbstractDeclarator extends Node {
    declarator: AbstractDeclarator;
    constructor(location: SourceLocation, declarator: AbstractDeclarator) {
        super(location);
        this.declarator = declarator;
    }
}
export class AbstractPointerDeclarator extends AbstractDeclarator {
    pointer: Pointer;
    constructor(location: SourceLocation, declarator: AbstractDeclarator, pointer: Pointer) {
        super(location, declarator);
        this.pointer = pointer;
    }
}
export class AbstractArrayDeclarator extends AbstractDeclarator {
    static: boolean;
    qualifiers: string[];
    length: Expression;
    variableLength: boolean;
    constructor(location: SourceLocation, declarator: AbstractDeclarator, static_: boolean, qualifiers: string[], length: Expression, variableLength: boolean) {
        super(location, declarator);
        this.static = static_;
        this.qualifiers = qualifiers;
        this.length = length;
        this.variableLength = variableLength;
    }
}
export class AbstractFunctionDeclarator extends AbstractDeclarator {
    parameters: ParameterList|Identifier[];
    constructor(location: SourceLocation, declarator: AbstractDeclarator, parameters: ParameterList|Identifier[]) {
        super(location, declarator);
        this.parameters = parameters;
    }
}
export class InitializerListItem extends Node {
    designators: Designator[];
    initializer: Expression|InitializerList;
    offsetToParent: number;
    constructor(location: SourceLocation, designators: Designator[], initializer: Expression|InitializerList) {
        super(location);
        this.designators = designators;
        this.initializer = initializer;
        this.offsetToParent = -1;
    }
}
export class InitializerList extends Node {
    items: InitializerListItem[];
    constructor(location: SourceLocation, items: InitializerListItem[]) {
        super(location);
        this.items = items;
    }
}
export class Designator extends Node {
    constructor(location: SourceLocation) {
        super(location);
    }
}
export class SubscriptDesignator extends Designator {
    subscript: Expression;
    constructor(location: SourceLocation, subscript: Expression) {
        super(location);
        this.subscript = subscript;
    }
}
export class MemberDesignator extends Designator {
    member: Identifier;
    constructor(location: SourceLocation, member: Identifier) {
        super(location);
        this.member = member;
    }
}
export abstract class Statement extends Node {
    protected constructor(location: SourceLocation) {
        super(location);
    }
}
export class CaseStatement extends Statement {
    test: Expression;
    body: Statement;
    // TODO::
    // switchStatement: SwitchStatement;
    // caseValue: number;
    constructor(location: SourceLocation, test: Expression, body: Statement) {
        super(location);
        this.test = test;
        this.body = body;
        // this.switchStatement = null;
        // this.caseValue = null;
    }
}
export class LabeledStatement extends Statement {
    label: Identifier;
    body: Statement;
    constructor(location: SourceLocation, label: Identifier, body: Statement) {
        super(location);
        this.label = label;
        this.body = body;
    }
    getUniqueLabel() {
        return this.label.name;
    }
}
export class CompoundStatement extends Statement {
    leftBraceLocation: SourceLocation;
    rightBraceLocation: SourceLocation;
    body: (Declaration|Statement)[];
    constructor(location: SourceLocation, leftBraceLoc: SourceLocation, rightBraceLoc: SourceLocation, body: (Declaration|Statement)[]) {
        super(location);
        this.leftBraceLocation = leftBraceLoc;
        this.rightBraceLocation = rightBraceLoc;
        this.body = body;
    }
}
export class ExpressionStatement extends Statement {
    expression: Expression;
    constructor(location: SourceLocation, expression: Expression) {
        super(location);
        this.expression = expression;
    }
}
export class NullStatement extends Statement {
    constructor(location: SourceLocation) {
        super(location);
    }
}
export class IfStatement extends Statement {
    test: Expression;
    consequent: Statement;
    alternate: Statement|null;
    constructor(location: SourceLocation, test: Expression, consequent: Statement, alternate: Statement|null) {
        super(location);
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }
}
export class SwitchStatement extends Statement {
    discriminant: Expression;
    body: Statement;
    targetStatements: CaseStatement[];
    invalidateScopeOnJump: Map<string, {childKey: Symbol, parentKey: Symbol}>;
    caseValues: Set<number>;
    constructor(location: SourceLocation, discriminant: Expression, body: Statement) {
        super(location);
        this.discriminant = discriminant;
        this.body = body;
        this.caseValues = new Set();
        this.targetStatements = [];
        this.invalidateScopeOnJump = new Map();
    }
}
export class WhileStatement extends Statement {
    test: Expression;
    body: Statement;
    constructor(location: SourceLocation, test: Expression, body: Statement) {
        super(location);
        this.test = test;
        this.body = body;
    }
}
export class DoWhileStatement extends Statement {
    body: Statement;
    test: Expression;
    constructor(location: SourceLocation, body: Statement, test: Expression) {
        super(location);
        this.body = body;
        this.test = test;
    }
}
export class ForStatement extends Statement {
    init: Expression|Declaration|null;
    test: Expression|null;
    update: Expression|null;
    body: Statement;
    constructor(location: SourceLocation, init: Expression|Declaration|null, test: Expression|null, update: Expression|null, body: Statement) {
        super(location);
        this.init = init;
        this.test = test;
        this.update = update;
        this.body = body;
    }
}
export class GotoStatement extends Statement {
    label: Identifier;
    targetStatements: LabeledStatement[];
    invalidateScopeOnJump: Map<string, {childKey: Symbol, parentKey: Symbol}>;
    constructor(location: SourceLocation, label: Identifier) {
        super(location);
        this.label = label;
        this.targetStatements = [];
        this.invalidateScopeOnJump = new Map();
    }
}
export class ContinueStatement extends Statement {
    surroundingStatement: WhileStatement|ForStatement|DoWhileStatement|null;
    constructor(location: SourceLocation) {
        super(location);
        this.surroundingStatement = null;
    }
}
export class BreakStatement extends Statement {
    surroundingStatement: WhileStatement|ForStatement|DoWhileStatement|SwitchStatement|null;
    constructor(location: SourceLocation) {
        super(location);
        this.surroundingStatement = null;
    }
}
export class ReturnStatement extends Statement {
    argument: Expression|null;
    constructor(location: SourceLocation, argument: Expression|null) {
        super(location);
        this.argument = argument;
    }
}
export class TranslationUnit extends Node {
    body: (FunctionDefinition|Declaration)[];
    constructor(location: SourceLocation, body: (FunctionDefinition|Declaration)[]) {
        super(location);
        this.body = body;
    }
}
export class FunctionDefinition extends Node {
    specifiers: (string|AtomicTypeSpecifier|StructOrUnionSpecifier|EnumSpecifier|TypedefName|AlignmentSpecifier)[];
    declarator: Declarator;
    declarations: Declaration[]|null;
    body: CompoundStatement;
    parameterNames: string[];
    name: string;
    constructor(location: SourceLocation, specifiers: (string|AtomicTypeSpecifier|StructOrUnionSpecifier|EnumSpecifier|TypedefName|AlignmentSpecifier)[], declarator: Declarator, declarations: Declaration[]|null, body: CompoundStatement) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
        this.declarations = declarations;
        this.body = body;
        this.parameterNames = [];
        this.name = '';
    }
}
export class PreprocessingFile extends Node {
    body: (Directive|IfSection|TextBlock)[];
    constructor(location: SourceLocation, body: (Directive|IfSection|TextBlock)[]) {
        super(location);
        this.body = body;
    }
}
export class Directive extends Node {
    tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]|null;
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]|null) {
        super(location);
        this.tokens = tokens;
    }
}
export class IfSection extends Node {
    ifGroup: IfGroup|IfdefGroup|IfndefGroup;
    elseIfGroups: ElifGroup[];
    elseGroup: ElseGroup|null;
    constructor(location: SourceLocation, ifGroup: IfGroup|IfdefGroup|IfndefGroup, elseIfGroups: ElifGroup[], elseGroup: ElseGroup|null) {
        super(location);
        this.ifGroup = ifGroup;
        this.elseIfGroups = elseIfGroups;
        this.elseGroup = elseGroup;
    }
}
export class IfGroup extends Directive {
    body: (Directive|IfSection|TextBlock)[];
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[], body: (Directive|IfSection|TextBlock)[]) {
        super(location, tokens);
        this.body = body;
    }
}
export class IfdefGroup extends Directive {
    test: Identifier;
    body: (Directive|IfSection|TextBlock)[];
    constructor(location: SourceLocation, test: Identifier, body: (Directive|IfSection|TextBlock)[]) {
        super(location, null);
        this.test = test;
        this.body = body;
    }
}
export class IfndefGroup extends Directive {
    test: Identifier;
    body: (Directive|IfSection|TextBlock)[];
    constructor(location: SourceLocation, test: Identifier, body: (Directive|IfSection|TextBlock)[]) {
        super(location, null);
        this.test = test;
        this.body = body;
    }
}
export class ElifGroup extends Directive {
    body: (Directive|IfSection|TextBlock)[];
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[], body: (Directive|IfSection|TextBlock)[]) {
        super(location, tokens);
        this.body = body;
    }
}
export class ElseGroup extends Directive {
    body: (Directive|IfSection|TextBlock)[];
    constructor(location: SourceLocation, body: (Directive|IfSection|TextBlock)[]) {
        super(location, null);
        this.body = body;
    }
}
export class IncludeDirective extends Directive {
    headerName: HeaderName|null;
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]|null, headerName: HeaderName|null) {
        super(location, tokens);
        this.headerName = headerName;
    }
}
export class ObjectLikeDefineDirective extends Directive {
    name: Identifier;
    replacements: Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar[];
    constructor(location: SourceLocation, name: Identifier, replacements: Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar[]) {
        super(location, null);
        this.name = name;
        this.replacements = replacements;
    }
}
export class FunctionLikeDefineDirective extends Directive {
    name: Identifier;
    parameters: Identifier[];
    variableArguments: boolean;
    replacements: PpChar[];
    constructor(location: SourceLocation, name: Identifier, parameters: Identifier[], variableArguments: boolean, replacements: PpChar[]) {
        super(location, null);
        this.name = name;
        this.parameters = parameters;
        this.variableArguments = variableArguments;
        this.replacements = replacements;
    }
}
export class UndefDirective extends Directive {
    name: Identifier;
    constructor(location: SourceLocation, name: Identifier) {
        super(location, null);
        this.name = name;
    }
}
export class LineDirective extends Directive {
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]) {
        super(location, tokens);
    }
}
export class ErrorDirective extends Directive {
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]) {
        super(location, tokens);
    }
}
export class PragmaDirective extends Directive {
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]) {
        super(location, tokens);
    }
}
export class NullDirective extends Directive {
    constructor(location: SourceLocation) {
        super(location, null);
    }
}
export class TextBlock extends Node {
    tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[];
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]) {
        super(location);
        this.tokens = tokens;
    }
}
export class NonDirective extends Directive {
    constructor(location: SourceLocation, tokens: (Identifier|PpNumber|CharacterConstant|StringLiteral|Punctuator|PpChar)[]) {
        super(location, tokens);
    }
}