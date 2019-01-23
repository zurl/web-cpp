import {InternalError, SyntaxError} from "../../common/error";
import {ClassDirective, Node, SourceLocation} from "../../common/node";
import {AddressType} from "../../common/symbol";
import {getAccessControlFromString} from "../../type";
import {ClassType, Inheritance} from "../../type/class_type";
import {PrimitiveTypes} from "../../type/primitive_type";
import {WGetAddress, WGetFunctionAddress, WMemoryLocation} from "../../wasm/expression";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {Declaration} from "../declaration/declaration";
import {AnonymousExpression} from "../expression/anonymous_expression";
import {AssignmentExpression} from "../expression/assignment_expression";
import {Identifier} from "../expression/identifier";
import {FunctionDefinition} from "../function/function_definition";
import {ParameterList} from "../function/parameter_list";
import {CompoundStatement} from "../statement/compound_statement";
import {ExpressionStatement} from "../statement/expression_statement";
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

        const isVirtual = this.isVirtual(inheritance);
        if (isVirtual) {
            classType.setUpVPtr();
        }

        // find virtual

        ctx.scopeManager.define(lookupName, classType, this);
        const activeScopes = ctx.scopeManager.currentContext.activeScopes;
        ctx.scopeManager.enterScope(fullName);
        ctx.scopeManager.activeScopes(activeScopes);

        ctx.scopeManager.currentContext.scope.classType = classType;
        this.declarations.map((x) => x.declare(ctx, classType));
        classType.initialize();
        if (isVirtual) {
            this.generateVTable(ctx, classType);
        }
        this.declarations.map((x) => x.codegen(ctx));
        this.generateDefaultConstructor(ctx);
        this.generateDefaultDestructor(ctx);
        ctx.scopeManager.exitScope();

        return classType;
    }

    public generateVTable(ctx: CompileContext, classType: ClassType) {
        const vTablesize = 4 * classType.vTable.vFunctions.length;
        classType.vTablePtr = ctx.memory.allocData(vTablesize);
        for (let i = 0; i < classType.vTable.vFunctions.length; i++) {
            const vTablePtrExpr = new WGetAddress(WMemoryLocation.DATA, this.location);
            vTablePtrExpr.offset = classType.vTablePtr + i * 4;
            const vTableExpr = new AnonymousExpression(this.location, {
                type: PrimitiveTypes.int32,
                expr: new WAddressHolder(vTablePtrExpr, AddressType.RVALUE, this.location),
                isLeft: true,
            });
            const vFuncName = classType.vTable.vFunctions[i].fullName;
            new ExpressionStatement(this.location, new AssignmentExpression(this.location,
                "=",
                vTableExpr,
                new AnonymousExpression(this.location, {
                    type: PrimitiveTypes.int32,
                    isLeft: false,
                    expr: new WGetFunctionAddress(vFuncName, this.location),
                }))).codegen(ctx);
        }
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

export class AccessControlLabel extends ClassDirective {
    public label: string;

    constructor(location: SourceLocation, label: string) {
        super(location);
        this.label = label;
    }

    public codegen(ctx: CompileContext): void {
        return;
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        classType.accessControl = getAccessControlFromString(this.label);
    }

}
