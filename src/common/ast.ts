import * as Long from "long";
import {CompileContext} from "../codegen/context";
import {FunctionEntity} from "../codegen/scope";
import {InternalError} from "./error";
import {Type} from "./type";

export type SpecifierType =
    string
    | AtomicTypeSpecifier
    | StructOrUnionSpecifier
    | EnumSpecifier
    | TypedefName
    | AlignmentSpecifier;

export enum ExpressionResultType {
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
    public source: string;
    public start: Position;
    public end: Position;

    constructor(source: string, start: Position, end: Position) {
        this.source = source;
        this.start = start;
        this.end = end;
    }

    public toString() {
        return `${this.start.line}(${this.start.column}) - ${this.end.line}(${this.end.column})`;
    }
}

export abstract class Node {
    public location: SourceLocation;
    public parentNode: Node | null;

    protected constructor(location: SourceLocation) {
        this.location = location;
        this.parentNode = null;
    }

    public codegen(ctx: CompileContext): any {
        throw new Error("no_impl at " + this.constructor.name);
    }
}

export class Comment extends Node {
    public value: string;

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
    public value: string;

    constructor(location: SourceLocation, value: string) {
        super(location);
        this.value = value;
    }
}

export class Expression extends Node {
    constructor(location: SourceLocation) {
        super(location);
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        return super.codegen(ctx);
    }

    public deduceType(ctx: CompileContext): Type {
        throw new InternalError(`not impl at ${this.constructor.name}`);
    }
}

export class Identifier extends Expression {
    public name: string;
    public mangledName: string | null;

    constructor(location: SourceLocation, name: string) {
        super(location);
        this.name = name;
        this.mangledName = null; // 如果访问static变量，这里是mangledName，格式是name.Symbol(scopeName)
    }

    get value() { // alias
        return this.name;
    }
}

export class Constant extends Expression {
    constructor(location: SourceLocation) {
        super(location);
    }
}

export class IntegerConstant extends Constant {
    public base: number;
    public value: Long;
    public raw: string;
    public suffix: string | null;

    constructor(location: SourceLocation, base: number, value: Long, raw: string, suffix: string | null) {
        super(location);
        this.base = base;
        this.value = value;
        this.raw = raw;
        this.suffix = suffix;
    }
}

export class FloatingConstant extends Constant {
    public value: number;
    public raw: string;
    public suffix: string | null;

    constructor(location: SourceLocation, value: number, raw: string, suffix: string | null) {
        super(location);
        this.value = value;
        this.raw = raw;
        this.suffix = suffix;
    }
}

export class CharacterConstant extends Constant {
    public value: string;
    public prefix: string | null;

    constructor(location: SourceLocation, value: string, prefix: string | null) {
        super(location);
        this.value = value;
        this.prefix = prefix;
    }
}

export class StringLiteral extends Expression {
    public prefix: string | null;
    public value: string;

    constructor(location: SourceLocation, prefix: string | null, value: string) {
        super(location);
        this.prefix = prefix;
        this.value = value;
    }
}

export class Punctuator extends Node {
    public value: string;

    constructor(location: SourceLocation, value: string) {
        super(location);
        this.value = value;
    }
}

export class HeaderName extends Node {
    public name: string;
    public quoted: boolean;

    constructor(location: SourceLocation, name: string, quoted: boolean) {
        super(location);
        this.name = name;
        this.quoted = quoted;
    }
}

export class PpNumber extends Node {
    public raw: string;

    constructor(location: SourceLocation, raw: string) {
        super(location);
        this.raw = raw;
    }

    get value() { // alias
        return this.raw;
    }
}

export class ParenthesisExpression extends Expression {
    public expression: Expression;

    constructor(location: SourceLocation, expression: Expression) {
        super(location);
        this.expression = expression;
    }
}

export class GenericAssociation extends Node {
    public test: TypeName | null;
    public consequent: Expression;

    constructor(location: SourceLocation, test: TypeName | null, consequent: Expression) {
        super(location);
        this.test = test;
        this.consequent = consequent;
    }
}

export class GenericSelection extends Expression {
    public discriminant: Expression;
    public associations: GenericAssociation[];

    constructor(location: SourceLocation, discriminant: Expression, associations: GenericAssociation[]) {
        super(location);
        this.discriminant = discriminant;
        this.associations = associations;
    }
}

export class CompoundLiteral extends Expression {
    public typeName: TypeName;
    public initializerList: InitializerList;

    constructor(location: SourceLocation, typeName: TypeName, initializerList: InitializerList) {
        super(location);
        this.typeName = typeName;
        this.initializerList = initializerList;
    }
}

export class SubscriptExpression extends Expression {
    public array: Expression;
    public subscript: Expression;

    constructor(location: SourceLocation, array: Expression, subscript: Expression) {
        super(location);
        this.array = array;
        this.subscript = subscript;
    }
}

export class CallExpression extends Expression {
    public callee: Expression;
    public arguments: Expression[];

    constructor(location: SourceLocation, callee: Expression, myArguments: Expression[]) {
        super(location);
        this.callee = callee;
        this.arguments = myArguments;
    }
}

export class MemberExpression extends Expression {
    public object: Expression;
    public pointed: boolean;
    public member: Identifier;
    public offset: number;
    public size: 0;

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
    public operand: Expression;
    public decrement: boolean;

    constructor(location: SourceLocation, operand: Expression, decrement: boolean) {
        super(location);
        this.operand = operand;
        this.decrement = decrement;
    }
}

export class UnaryExpression extends Expression {
    public operator: string; // ++, --, sizeof, *, +, -, !, ~
    public operand: Expression;

    constructor(location: SourceLocation, operator: string, operand: Expression) {
        super(location);
        this.operator = operator;
        this.operand = operand;
    }
}

export class CastExpression extends Expression {
    public typeName: TypeName;
    public operand: Expression;

    constructor(location: SourceLocation, typeName: TypeName, operand: Expression) {
        super(location);
        this.typeName = typeName;
        this.operand = operand;
    }
}

export class BinaryExpression extends Expression {
    public operator: string;
    // + - * / % & | && || < > <= >= == !=
    public left: Expression;
    public right: Expression;

    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        if (typeof operator[1] === "undefined") { // HACK: for rule '&'!'&' this will receive ["&", undefined]
            this.operator = operator[0];
        } else {
            this.operator = operator;
        }
        this.left = left;
        this.right = right;
    }
}

export class ConditionalExpression extends Expression {
    public test: Expression;
    public consequent: Expression;
    public alternate: Expression;

    constructor(location: SourceLocation, test: Expression, consequent: Expression, alternate: Expression) {
        super(location);
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }
}

export class AssignmentExpression extends Expression {
    public operator: string;
    public left: Expression;
    public right: Expression;
    public isInitExpr: boolean;

    constructor(location: SourceLocation, operator: string, left: Expression, right: Expression) {
        super(location);
        this.operator = operator;
        this.left = left;
        this.right = right;
        this.isInitExpr = false;
    }
}

export class Declaration extends Node {
    public specifiers: SpecifierType[];
    public initDeclarators: InitDeclarator[];
    public isStatic: boolean;
    public isTypedef: boolean;

    constructor(location: SourceLocation, specifiers: SpecifierType[], initDeclarators: InitDeclarator[]) {
        super(location);
        this.specifiers = specifiers;
        this.initDeclarators = initDeclarators;
        this.isStatic = false; // set in syntax-check
        this.isTypedef = false; // set in syntax-check
    }
}

export class AtomicTypeSpecifier extends Node {
    public typeName: TypeName;

    constructor(location: SourceLocation, typeName: TypeName) {
        super(location);
        this.typeName = typeName;
    }
}

export class StructOrUnionSpecifier extends Node {
    public union: boolean;
    public identifier: Identifier;
    public declarations: StructDeclaration[] | null;

    constructor(location: SourceLocation, union: boolean,
                identifier: Identifier, declarations: StructDeclaration[] | null) {
        super(location);
        this.union = union;
        this.identifier = identifier;
        this.declarations = declarations;
    }
}

export class StructDeclaration extends Node {
    public specifierQualifiers: Array<string | AtomicTypeSpecifier |
        StructOrUnionSpecifier | EnumSpecifier | TypedefName>;
    public declarators: StructDeclarator[];

    constructor(location: SourceLocation, specifierQualifiers: Array<string |
                    AtomicTypeSpecifier | StructOrUnionSpecifier | EnumSpecifier | TypedefName>,
                declarators: StructDeclarator[]) {
        super(location);
        this.specifierQualifiers = specifierQualifiers;
        this.declarators = declarators;
    }
}

export class StructDeclarator extends Node {
    public declarator: Declarator | null;
    public width: Expression | null;

    constructor(location: SourceLocation, declarator: Declarator | null, width: Expression | null) {
        super(location);
        this.declarator = declarator;
        this.width = width;
    }
}

export class EnumSpecifier extends Node {
    public identifier: Identifier;
    public enumerators: Enumerator[] | null;

    constructor(location: SourceLocation, identifier: Identifier, enumerators: Enumerator[] | null) {
        super(location);
        this.identifier = identifier;
        this.enumerators = enumerators;
    }
}

export class Enumerator extends Node {
    public identifier: Identifier;
    public value: Expression | null;

    constructor(location: SourceLocation, identifier: Identifier, value: Expression | null) {
        super(location);
        this.identifier = identifier;
        this.value = value;
    }
}

export class TypedefName extends Node {
    public identifier: Identifier;

    constructor(location: SourceLocation, identifier: Identifier) {
        super(location);
        this.identifier = identifier;
    }
}

export class AlignmentSpecifier extends Node {
    public alignment: TypeName | Expression;

    constructor(location: SourceLocation, alignment: TypeName | Expression) {
        super(location);
        this.alignment = alignment;
    }
}

export class InitDeclarator extends Node {
    public declarator: Declarator;
    public initializer: Expression | InitializerList | null;
    public isObjectDeclarator: boolean;

    constructor(location: SourceLocation, declarator: Declarator, initializer: Expression | InitializerList | null) {
        super(location);
        this.declarator = declarator;
        this.initializer = initializer;
        this.isObjectDeclarator = true; // not function, set in syntax-check
    }
}

export class StaticAssertDeclaration extends Declaration {
    public test: Expression;
    public message: StringLiteral;

    constructor(location: SourceLocation, test: Expression, message: StringLiteral) {
        super(location, [], []);
        this.test = test;
        this.message = message;
    }
}

export class Declarator extends Node {
    public declarator: Declarator | null;

    constructor(location: SourceLocation, declarator: Declarator | null) {
        super(location);
        this.declarator = declarator;
    }
}

export class PointerDeclarator extends Declarator {
    public pointer: Pointer;

    constructor(location: SourceLocation, declarator: Declarator, pointer: Pointer) {
        super(location, declarator);
        this.pointer = pointer;
    }
}

export class Pointer extends Node {
    public qualifiers: string[];
    public pointer: Pointer | null;

    constructor(location: SourceLocation, qualifiers: string[], pointer: Pointer | null) {
        super(location);
        this.qualifiers = qualifiers;
        this.pointer = pointer;
    }
}

export class IdentifierDeclarator extends Declarator {
    public identifier: Identifier;

    constructor(location: SourceLocation, identifier: Identifier) {
        super(location, null);
        this.identifier = identifier;
    }
}

export class ArrayDeclarator extends Declarator {
    public static: boolean;
    public qualifiers: string[];
    public length: Expression;
    public variableLength: boolean;

    constructor(location: SourceLocation, declarator: Declarator,
                isStatic: boolean, qualifiers: string[],
                length: Expression, variableLength: boolean) {
        super(location, declarator);
        this.static = isStatic;
        this.qualifiers = qualifiers;
        this.length = length;
        this.variableLength = variableLength;
    }
}

export class FunctionDeclarator extends Declarator {
    public parameters: ParameterList | Identifier[];

    constructor(location: SourceLocation, declarator: Declarator, parameters: ParameterList | Identifier[]) {
        super(location, declarator);
        this.parameters = parameters;
    }
}

export class ParameterList extends Node {
    public parameters: ParameterDeclaration[];
    public variableArguments: boolean;

    constructor(location: SourceLocation, parameters: ParameterDeclaration[] = [], variableArguments: boolean = false) {
        super(location);
        this.parameters = parameters;
        this.variableArguments = variableArguments;
    }
}

export class ParameterDeclaration extends Node {
    public specifiers: SpecifierType[];
    public declarator: Declarator | AbstractDeclarator | null;

    constructor(location: SourceLocation, specifiers: SpecifierType[],
                declarator: Declarator | AbstractDeclarator | null) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
    }
}

export class TypeName extends Node {
    public specifierQualifiers: SpecifierType[];
    public declarator: AbstractDeclarator | null;

    constructor(location: SourceLocation, specifierQualifiers: SpecifierType[], declarator: AbstractDeclarator | null) {
        super(location);
        this.specifierQualifiers = specifierQualifiers;
        this.declarator = declarator;
    }
}

export class AbstractDeclarator extends Node {
    public declarator: AbstractDeclarator;

    constructor(location: SourceLocation, declarator: AbstractDeclarator) {
        super(location);
        this.declarator = declarator;
    }
}

export class AbstractPointerDeclarator extends AbstractDeclarator {
    public pointer: Pointer;

    constructor(location: SourceLocation, declarator: AbstractDeclarator, pointer: Pointer) {
        super(location, declarator);
        this.pointer = pointer;
    }
}

export class AbstractArrayDeclarator extends AbstractDeclarator {
    public static: boolean;
    public qualifiers: string[];
    public length: Expression;
    public variableLength: boolean;

    constructor(location: SourceLocation, declarator: AbstractDeclarator,
                isStatic: boolean, qualifiers: string[], length: Expression,
                variableLength: boolean) {
        super(location, declarator);
        this.static = isStatic;
        this.qualifiers = qualifiers;
        this.length = length;
        this.variableLength = variableLength;
    }
}

export class AbstractFunctionDeclarator extends AbstractDeclarator {
    public parameters: ParameterList | Identifier[];

    constructor(location: SourceLocation, declarator: AbstractDeclarator, parameters: ParameterList | Identifier[]) {
        super(location, declarator);
        this.parameters = parameters;
    }
}

export class InitializerListItem extends Node {
    public designators: Designator[];
    public initializer: Expression | InitializerList;
    public offsetToParent: number;

    constructor(location: SourceLocation, designators: Designator[], initializer: Expression | InitializerList) {
        super(location);
        this.designators = designators;
        this.initializer = initializer;
        this.offsetToParent = -1;
    }
}

export class InitializerList extends Node {
    public items: InitializerListItem[];

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
    public subscript: Expression;

    constructor(location: SourceLocation, subscript: Expression) {
        super(location);
        this.subscript = subscript;
    }
}

export class MemberDesignator extends Designator {
    public member: Identifier;

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
    public test: Expression;
    public body: Statement;
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
    public label: Identifier;
    public body: Statement;

    constructor(location: SourceLocation, label: Identifier, body: Statement) {
        super(location);
        this.label = label;
        this.body = body;
    }

    public getUniqueLabel() {
        return this.label.name;
    }
}

export class CompoundStatement extends Statement {
    public leftBraceLocation: SourceLocation;
    public rightBraceLocation: SourceLocation;
    public body: Array<Declaration | Statement>;

    constructor(location: SourceLocation, leftBraceLoc: SourceLocation,
                rightBraceLoc: SourceLocation,
                body: Array<Declaration | Statement>) {
        super(location);
        this.leftBraceLocation = leftBraceLoc;
        this.rightBraceLocation = rightBraceLoc;
        this.body = body;
    }
}

export class ExpressionStatement extends Statement {
    public expression: Expression;

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
    public test: Expression;
    public consequent: Statement;
    public alternate: Statement | null;

    constructor(location: SourceLocation, test: Expression, consequent: Statement, alternate: Statement | null) {
        super(location);
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }
}

export class SwitchStatement extends Statement {
    public discriminant: Expression;
    public body: Statement;
    public targetStatements: CaseStatement[];
    public caseValues: Set<number>;

    constructor(location: SourceLocation, discriminant: Expression, body: Statement) {
        super(location);
        this.discriminant = discriminant;
        this.body = body;
        this.caseValues = new Set();
        this.targetStatements = [];
    }
}

export class WhileStatement extends Statement {
    public test: Expression;
    public body: Statement;

    constructor(location: SourceLocation, test: Expression, body: Statement) {
        super(location);
        this.test = test;
        this.body = body;
    }
}

export class DoWhileStatement extends Statement {
    public body: Statement;
    public test: Expression;

    constructor(location: SourceLocation, body: Statement, test: Expression) {
        super(location);
        this.body = body;
        this.test = test;
    }
}

export class ForStatement extends Statement {
    public init: Expression | Declaration | null;
    public test: Expression | null;
    public update: Expression | null;
    public body: Statement;

    constructor(location: SourceLocation,
                init: Expression | Declaration | null,
                test: Expression | null,
                update: Expression | null,
                body: Statement) {
        super(location);
        this.init = init;
        this.test = test;
        this.update = update;
        this.body = body;
    }
}

export class GotoStatement extends Statement {
    public label: Identifier;

    constructor(location: SourceLocation, label: Identifier) {
        super(location);
        this.label = label;
    }
}

export class ContinueStatement extends Statement {
    public surroundingStatement: WhileStatement | ForStatement | DoWhileStatement | null;

    constructor(location: SourceLocation) {
        super(location);
        this.surroundingStatement = null;
    }
}

export class BreakStatement extends Statement {
    public surroundingStatement: WhileStatement | ForStatement | DoWhileStatement | SwitchStatement | null;

    constructor(location: SourceLocation) {
        super(location);
        this.surroundingStatement = null;
    }
}

export class ReturnStatement extends Statement {
    public argument: Expression | null;

    constructor(location: SourceLocation, argument: Expression | null) {
        super(location);
        this.argument = argument;
    }
}

export class TranslationUnit extends Node {
    public body: Array<FunctionDefinition | Declaration>;

    constructor(location: SourceLocation, body: Array<FunctionDefinition | Declaration>) {
        super(location);
        this.body = body;
    }
}

type DirectiveToken = Identifier | PpNumber | CharacterConstant | StringLiteral | Punctuator | PpChar;

export class FunctionDefinition extends Node {
    public specifiers: Array<string | AtomicTypeSpecifier | StructOrUnionSpecifier | EnumSpecifier
        | TypedefName | AlignmentSpecifier>;
    public declarator: Declarator;
    public declarations: Declaration[] | null;
    public body: CompoundStatement;
    public parameterNames: string[];
    public name: string;

    constructor(location: SourceLocation, specifiers: Array<string |
                    AtomicTypeSpecifier | StructOrUnionSpecifier | EnumSpecifier |
                    TypedefName | AlignmentSpecifier>,
                declarator: Declarator,
                declarations: Declaration[] | null, body: CompoundStatement) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
        this.declarations = declarations;
        this.body = body;
        this.parameterNames = [];
        this.name = "";
    }
}

export class PreprocessingFile extends Node {
    public body: Array<Directive | IfSection | TextBlock>;

    constructor(location: SourceLocation, body: Array<Directive | IfSection | TextBlock>) {
        super(location);
        this.body = body;
    }
}

export class Directive extends Node {
    public tokens: DirectiveToken[] | null;

    constructor(location: SourceLocation, tokens: DirectiveToken[] | null) {
        super(location);
        this.tokens = tokens;
    }
}

export class IfSection extends Node {
    public ifGroup: IfGroup | IfdefGroup | IfndefGroup;
    public elseIfGroups: ElifGroup[];
    public elseGroup: ElseGroup | null;

    constructor(location: SourceLocation,
                ifGroup: IfGroup | IfdefGroup | IfndefGroup,
                elseIfGroups: ElifGroup[],
                elseGroup: ElseGroup | null) {
        super(location);
        this.ifGroup = ifGroup;
        this.elseIfGroups = elseIfGroups;
        this.elseGroup = elseGroup;
    }
}

export class IfGroup extends Directive {
    public body: Array<Directive | IfSection | TextBlock>;

    constructor(location: SourceLocation, tokens: DirectiveToken[], body: Array<Directive | IfSection | TextBlock>) {
        super(location, tokens);
        this.body = body;
    }
}

export class IfdefGroup extends Directive {
    public test: Identifier;
    public body: Array<Directive | IfSection | TextBlock>;

    constructor(location: SourceLocation, test: Identifier, body: Array<Directive | IfSection | TextBlock>) {
        super(location, null);
        this.test = test;
        this.body = body;
    }
}

export class IfndefGroup extends Directive {
    public test: Identifier;
    public body: Array<Directive | IfSection | TextBlock>;

    constructor(location: SourceLocation, test: Identifier, body: Array<Directive | IfSection | TextBlock>) {
        super(location, null);
        this.test = test;
        this.body = body;
    }
}

export class ElifGroup extends Directive {
    public body: Array<Directive | IfSection | TextBlock>;

    constructor(location: SourceLocation, tokens: DirectiveToken[], body: Array<Directive | IfSection | TextBlock>) {
        super(location, tokens);
        this.body = body;
    }
}

export class ElseGroup extends Directive {
    public body: Array<Directive | IfSection | TextBlock>;

    constructor(location: SourceLocation, body: Array<Directive | IfSection | TextBlock>) {
        super(location, null);
        this.body = body;
    }
}

export class IncludeDirective extends Directive {
    public headerName: HeaderName | null;

    constructor(location: SourceLocation, tokens: DirectiveToken[] | null, headerName: HeaderName | null) {
        super(location, tokens);
        this.headerName = headerName;
    }
}

export class ObjectLikeDefineDirective extends Directive {
    public name: Identifier;
    public replacements: DirectiveToken[];

    constructor(location: SourceLocation, name: Identifier, replacements: DirectiveToken[]) {
        super(location, null);
        this.name = name;
        this.replacements = replacements;
    }
}

export class FunctionLikeDefineDirective extends Directive {
    public name: Identifier;
    public parameters: Identifier[];
    public variableArguments: boolean;
    public replacements: PpChar[];

    constructor(location: SourceLocation, name: Identifier, parameters: Identifier[],
                variableArguments: boolean, replacements: PpChar[]) {
        super(location, null);
        this.name = name;
        this.parameters = parameters;
        this.variableArguments = variableArguments;
        this.replacements = replacements;
    }
}

export class UndefDirective extends Directive {
    public name: Identifier;

    constructor(location: SourceLocation, name: Identifier) {
        super(location, null);
        this.name = name;
    }
}

export class LineDirective extends Directive {
    constructor(location: SourceLocation, tokens: DirectiveToken[]) {
        super(location, tokens);
    }
}

export class ErrorDirective extends Directive {
    constructor(location: SourceLocation, tokens: DirectiveToken[]) {
        super(location, tokens);
    }
}

export class PragmaDirective extends Directive {
    constructor(location: SourceLocation, tokens: DirectiveToken[]) {
        super(location, tokens);
    }
}

export class NullDirective extends Directive {
    constructor(location: SourceLocation) {
        super(location, null);
    }
}

export class TextBlock extends Node {
    public tokens: DirectiveToken[];

    constructor(location: SourceLocation, tokens: DirectiveToken[]) {
        super(location);
        this.tokens = tokens;
    }
}

export class NonDirective extends Directive {
    constructor(location: SourceLocation, tokens: DirectiveToken[]) {
        super(location, tokens);
    }
}
