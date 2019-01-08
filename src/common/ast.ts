import * as Long from "long";
import {CompileContext} from "../codegen/context";
import {FunctionLookUpResult} from "../codegen/scope";
import {Type} from "../type";
import {WExpression} from "../wasm/node";
import {InternalError} from "./error";

export type SpecifierType =
    string
    | TypeIdentifier
    | ClassSpecifier
    | EnumSpecifier;

export type ExternalDeclartions
    = FunctionDefinition | Declaration | UsingStatement | UsingNamespaceStatement | NameSpaceBlock;

export interface ExpressionResult {
    type: Type;
    expr: WExpression | FunctionLookUpResult;
    isLeft: boolean;
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

const EmptyLocation = new SourceLocation("", "",
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

    public codegen(ctx: CompileContext): any {
        throw new InternalError("no_impl at " + this.constructor.name);
    }

    public preprocess(ctx: CompileContext): any {
        throw new InternalError("no_impl at " + this.constructor.name);
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

    constructor(location: SourceLocation, name: string) {
        super(location);
        this.name = name;
    }
}

export class TypeID extends Node {
    public specs: SpecifierType[];
    public decl: AbstractDeclarator | null ;

    constructor(location: SourceLocation, specs: SpecifierType[], decl: AbstractDeclarator | null) {
        super(location);
        this.specs = specs;
        this.decl = decl;
    }
}

export class TypeIdentifier extends Node {
    public name: string;

    constructor(location: SourceLocation, name: string) {
        super(location);
        this.name = name;
    }
}

export class TemplateFuncIdentifier extends Node {
    public name: string;

    constructor(location: SourceLocation, name: string) {
        super(location);
        this.name = name;
    }
}

export class TemplateClassIdentifier extends Node {
    public name: string;

    constructor(location: SourceLocation, name: string) {
        super(location);
        this.name = name;
    }
}

export class Constant extends Expression {
    constructor(location: SourceLocation) {
        super(location);
    }
}

export class IntegerConstant extends Constant {

    public static getZero() {
        return ZeroConstant;
    }

    public static getOne() {
        return OneConstant;
    }

    public static getNegOne() {
        return NegOneConstant;
    }

    public static fromNumber(location: SourceLocation, number: number) {
        return new IntegerConstant(
            location,
            10,
            Long.fromInt(number),
            number.toString(),
            null,
        );
    }

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

const ZeroConstant = IntegerConstant.fromNumber(EmptyLocation, 0);

const OneConstant = IntegerConstant.fromNumber(EmptyLocation, 1);

const NegOneConstant = IntegerConstant.fromNumber(EmptyLocation, -1);

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

export class ParenthesisExpression extends Expression {
    public expression: Expression;

    constructor(location: SourceLocation, expression: Expression) {
        super(location);
        this.expression = expression;
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

export class ConstructorCallExpression extends Expression {
    public name: TypeIdentifier;
    public arguments: Expression[];

    constructor(location: SourceLocation, name: TypeIdentifier, myArguments: Expression[]) {
        super(location);
        this.name = name;
        this.arguments = myArguments;
    }
}

export class MemberExpression extends Expression {
    public object: Expression;
    public pointed: boolean;
    public member: Identifier;
    public forceDynamic: boolean;

    constructor(location: SourceLocation, object: Expression, pointed: boolean, member: Identifier) {
        super(location);
        this.object = object;
        this.pointed = pointed;
        this.member = member;
        this.forceDynamic = false;
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

    constructor(location: SourceLocation, specifiers: SpecifierType[], initDeclarators: InitDeclarator[]) {
        super(location);
        this.specifiers = specifiers;
        this.initDeclarators = initDeclarators;
    }

    public getTypedefName(): string[] {
        return [];
    }
}

type ClassDirectives = Declaration | FunctionDefinition | ConstructorOrDestructorDeclaration | AccessControlLabel;

export class BaseSpecifier extends Node {
    public accessControl: string;
    public className: TypeIdentifier;

    constructor(location: SourceLocation, accessControl: string, className: TypeIdentifier) {
        super(location);
        this.accessControl = accessControl;
        this.className = className;
    }
}

export class ClassSpecifier extends Node {
    public typeName: string;
    public identifier: Identifier;
    public declarations: ClassDirectives[] | null;
    public inherits: BaseSpecifier[];

    constructor(location: SourceLocation, typeName: string,
                identifier: Identifier,
                declarations: ClassDirectives[] | null,
                inherits: BaseSpecifier[]) {
        super(location);
        this.typeName = typeName;
        this.identifier = identifier;
        this.declarations = declarations;
        this.inherits = inherits;
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

export class InitDeclarator extends Node {
    public declarator: Declarator;
    public initializer: Expression | ObjectInitializer| InitializerList | null;
    public isObjectDeclarator: boolean;

    constructor(location: SourceLocation, declarator: Declarator,
                initializer: Expression | ObjectInitializer | InitializerList | null) {
        super(location);
        this.declarator = declarator;
        this.initializer = initializer;
        this.isObjectDeclarator = true; // not function, set in syntax-check
    }
}

export class ObjectInitializer extends Node {
    public argus: Expression[];

    constructor(location: SourceLocation, argus: Expression[]) {
        super(location);
        this.argus = argus;
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
    public type: string;

    constructor(location: SourceLocation, qualifiers: string[], pointer: Pointer | null, type: string) {
        super(location);
        this.qualifiers = qualifiers;
        this.pointer = pointer;
        this.type = type;
    }
}

export class IdentifierDeclarator extends Declarator {
    public identifier: Identifier | TemplateClassInstanceIdentifier | TemplateFuncInstanceIdentifier;

    constructor(location: SourceLocation,
                identifier: Identifier | TemplateClassInstanceIdentifier | TemplateFuncInstanceIdentifier) {
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

export interface ParameterListParseResult {
    types: Type[];
    names: string[];
    inits: Array<string | null>;
    isVariableArguments: boolean;
}

export class ParameterList extends Node {
    public parameters: ParameterDeclaration[];
    public variableArguments: boolean;

    constructor(location: SourceLocation, parameters: ParameterDeclaration[] = [], variableArguments: boolean = false) {
        super(location);
        this.parameters = parameters;
        this.variableArguments = variableArguments;
    }

    public codegen(ctx: CompileContext): ParameterListParseResult {
        return {types: [], names: [], inits: [], isVariableArguments: false};
    }
}

// TODO:: init param
export class ParameterDeclaration extends Node {
    public specifiers: SpecifierType[];
    public declarator: Declarator | AbstractDeclarator | null;
    public init: AssignmentExpression | null;

    constructor(location: SourceLocation, specifiers: SpecifierType[],
                declarator: Declarator | AbstractDeclarator | null, init: AssignmentExpression | null) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
        this.init = init;
    }
}

export class TypeName extends Expression {
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

    constructor(location: SourceLocation, designators: Designator[], initializer: Expression | InitializerList) {
        super(location);
        this.designators = designators;
        this.initializer = initializer;
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
    constructor(location: SourceLocation, test: Expression, body: Statement) {
        super(location);
        this.test = test;
        this.body = body;
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

    constructor(location: SourceLocation, discriminant: Expression, body: Statement) {
        super(location);
        this.discriminant = discriminant;
        this.body = body;
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
    public body: ExternalDeclartions[];

    constructor(location: SourceLocation, body: ExternalDeclartions[]) {
        super(location);
        this.body = body;
    }
}

export class FunctionDefinition extends Node {
    public specifiers: SpecifierType[];
    public declarator: Declarator;
    public declarations: Declaration[] | null;
    public body: CompoundStatement;
    public parameterNames: string[];
    public name: string;

    constructor(location: SourceLocation, specifiers: SpecifierType[],
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

export class ConstructorOrDestructorDeclaration extends Node {
    public isCtor: boolean;
    public name: TypeIdentifier;
    public param: ParameterList | null;
    public initList: ConstructorInitializeItem[] | null;
    public body: CompoundStatement | null;
    public isVirtual: boolean;

    constructor(location: SourceLocation, isCtor: boolean, name: TypeIdentifier, param: ParameterList | null,
                initList: ConstructorInitializeItem[] | null, body: CompoundStatement | null,
                isVirtual: boolean) {
        super(location);
        this.isCtor = isCtor;
        this.name = name;
        this.param = param;
        this.initList = initList;
        this.body = body;
        this.isVirtual = isVirtual;
    }
}

export class ConstructorInitializeItem extends Node {
    public key: Identifier;
    public value: Expression[];
    public isType: boolean;

    constructor(location: SourceLocation, key: Identifier, value: Expression[], isType: boolean) {
        super(location);
        this.key = key;
        this.value = value;
        this.isType = isType;
    }
}

export class AnonymousExpression extends Expression {
    public expr: ExpressionResult;

    constructor(location: SourceLocation, expr: ExpressionResult) {
        super(location);
        this.expr = expr;
    }

    public codegen(ctx: CompileContext): ExpressionResult {
        return this.expr;
    }

    public deduceType(ctx: CompileContext): Type {
        return this.expr.type;
    }
}

export class AccessControlLabel extends Node {
    public label: string;

    constructor(location: SourceLocation, label: string) {
        super(location);
        this.label = label;
    }
}

export class UsingStatement extends Node {
    public name: Identifier;
    public type: TypeName;

    constructor(location: SourceLocation, name: Identifier, type: TypeName) {
        super(location);
        this.name = name;
        this.type = type;
    }
}

export class UsingNamespaceStatement extends Node {
    public namespace: Identifier;

    constructor(location: SourceLocation, namespace: Identifier) {
        super(location);
        this.namespace = namespace;
    }
}

export class NameSpaceBlock extends Node {
    public namespace: Identifier;
    public statements: ExternalDeclartions[];

    constructor(location: SourceLocation, namespace: Identifier, statements: ExternalDeclartions[]) {
        super(location);
        this.namespace = namespace;
        this.statements = statements;
    }
}

export class DeleteExpression extends Expression {
    public expr: Expression;
    public isArrayDelete: boolean;

    constructor(location: SourceLocation, expr: Expression, isArrayDelete: boolean) {
        super(location);
        this.expr = expr;
        this.isArrayDelete = isArrayDelete;
    }
}

export class UsingItemStatement extends Statement {
    public identifier: Identifier;

    constructor(location: SourceLocation, identifier: Identifier) {
        super(location);
        this.identifier = identifier;
    }
}

export class NewExpression extends Expression {
    public name: TypeName;
    public arguments: Expression[];
    public placement: Expression | null;
    public arraySize: Expression | null;

    constructor(location: SourceLocation, name: TypeName,
                arguments_: Expression[], placement: Expression | null) {
        super(location);
        this.name = name;
        this.arguments = arguments_;
        this.placement = placement;
        this.arraySize = null;
        // do array transform
        if (this.name.declarator instanceof AbstractArrayDeclarator) {
            this.arraySize = this.name.declarator.length;
            this.name.declarator = null;
        }
    }
}

export class TypeParameter extends Node {
    public name: Identifier;
    public init: TypeName | null;

    constructor(location: SourceLocation, name: Identifier, init: TypeName | null) {
        super(location);
        this.name = name;
        this.init = init;
    }
}

export type TemplateParameterType = TypeParameter | ParameterDeclaration;
export type TemplateArgument = TypeName | Expression;

export class TemplateDeclaration extends Node {
    public decl: ClassSpecifier | FunctionDefinition;
    public args: TemplateParameterType[];

    constructor(location: SourceLocation, decl: ClassSpecifier | FunctionDefinition, args: TemplateParameterType[]) {
        super(location);
        this.decl = decl;
        this.args = args;
    }

    public getTemplateNames(): string[] {
        return[];
    }
}

export class TemplateClassInstanceIdentifier extends Node {
    public name: TemplateClassIdentifier;
    public args: TemplateArgument[];

    constructor(location: SourceLocation, name: TemplateClassIdentifier, args: TemplateArgument[]) {
        super(location);
        this.name = name;
        this.args = args;
    }
}

export class TemplateFuncInstanceIdentifier extends Expression {
    public name: TemplateFuncIdentifier;
    public args: TemplateArgument[];

    constructor(location: SourceLocation, name: TemplateFuncIdentifier, args: TemplateArgument[]) {
        super(location);
        this.name = name;
        this.args = args;
    }
}

export class FunctionTemplateInstantiation extends Node {
    public specifiers: SpecifierType[];
    public declarator: Declarator;

    constructor(location: SourceLocation, specifiers: SpecifierType[], declarator: Declarator) {
        super(location);
        this.specifiers = specifiers;
        this.declarator = declarator;
    }
}
