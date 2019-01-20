import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, Node, SourceLocation} from "../../common/node";
import {ClassType, Inheritance} from "../../type/class_type";
import {CompileContext} from "../context";
import {Declaration} from "../declaration/declaration";
import {ParameterList} from "../declaration/parameter_list";
import {Identifier} from "../expression/identifier";
import {FunctionDefinition} from "../function/function_definition";
import {CompoundStatement} from "../statement/compound_statement";
import {BaseSpecifier} from "./base_specifier";
import {ConstructorDeclaration} from "./constructor_declaration";
import {DestructorDeclaration} from "./destructor_declaration";

export class ClassSpecifier extends Node {
    public typeName: string; // "class" / "struct" / "union"
    public identifier: Identifier;
    public declarations: ClassDirective[] | null;
    public inherits: BaseSpecifier[];

    constructor(location: SourceLocation, typeName: string,
                identifier: Identifier,
                declarations: ClassDirective[] | null,
                inherits: BaseSpecifier[]) {
        super(location);
        this.typeName = typeName;
        this.identifier = identifier;
        this.declarations = declarations;
        this.inherits = inherits;
    }

    public isVirtual(inheritance: Inheritance[]) {
        if (this.declarations === null) {
            throw new InternalError(`public isVirtual(inheritance: Inheritance[]) `);
        }
        for (const decl of this.declarations) {
            if (decl instanceof Declaration || decl instanceof FunctionDefinition) {
                if (decl.specifiers.specifiers.includes("virtual")) {
                    return true;
                }
            } else if ( decl instanceof DestructorDeclaration) {
                if (decl.isVirtual) {
                    return true;
                }
            }
        }

        for (const parent of inheritance) {
            if (parent.classType.requireVPtr) {
                return true;
            }
        }
        return false;
    }

    public codegen(ctx: CompileContext): ClassType {

        const shortName = this.identifier.getShortName(ctx);
        const fullName = this.identifier.getFullName(ctx);
        const lookupName = this.identifier.getLookupName(ctx);

        const oldItem = ctx.scopeManager.lookup(lookupName);

        if (oldItem !== null) {
            if (this.declarations === null) {
                if (oldItem instanceof ClassType) {
                    return oldItem;
                } else {
                    throw new SyntaxError(`conflict type of ${lookupName}`, this);
                }
            } else {
                throw new SyntaxError(`redefine of ${lookupName}`, this);
            }
        }

        const inheritance = this.inherits.map((x) => x.codegen(ctx));

        const classType = new ClassType(shortName, fullName, ctx.fileName, [],
            this.typeName === "union", inheritance);

        if (this.declarations === null) {
            // incomplete definition;
            ctx.scopeManager.declare(lookupName, classType, this);
            return classType;
        }

        // find virtual
        const isVirtual = this.isVirtual(inheritance);
        if (isVirtual) {
            classType.setUpVPtr();
        }

        ctx.scopeManager.define(lookupName, classType, this);
        ctx.scopeManager.enterScope(fullName);
        ctx.scopeManager.currentContext.scope.classType = classType;
        this.declarations.map((x) => x.declare(ctx, classType));
        classType.initialize();
        if (isVirtual) {
            classType.generateVTable(ctx, this);
        }
        this.declarations.map((x) => x.codegen(ctx));
        this.generateDefaultConstructor(ctx);
        this.generateDefaultDestructor(ctx);
        ctx.scopeManager.exitScope();

        return classType;
    }

    private generateDefaultConstructor(ctx: CompileContext) {
        const shortName = this.identifier.getShortName(ctx);
        const fullName = this.identifier.getFullName(ctx);
        const item = ctx.scopeManager.lookup(fullName + "::#" + shortName);
        if (item === null) {
            new ConstructorDeclaration(this.location, this.identifier,
                new ParameterList(this.location), [],
                new CompoundStatement(this.location, [])).codegen(ctx);
        }
    }

    private generateDefaultDestructor(ctx: CompileContext) {
        const shortName = this.identifier.getShortName(ctx);
        const fullName = this.identifier.getFullName(ctx);
        const item = ctx.scopeManager.lookup(fullName + "::~" + shortName);
        if (item === null) {
            new DestructorDeclaration(this.location, this.identifier,
                new CompoundStatement(this.location, []), false).codegen(ctx);
        }
    }
}

export class AccessControlLabel extends Node {
    public label: string;

    constructor(location: SourceLocation, label: string) {
        super(location);
        this.label = label;
    }
}
