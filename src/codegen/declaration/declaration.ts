import {Directive, SourceLocation} from "../../common/node";
import {AccessControl} from "../../type";
import {ClassType} from "../../type/class_type";
import {TypeName} from "../class/type_name";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";
import {UsingStatement} from "../statement/using_statement";
import {InitDeclarator} from "./init_declartor";
import {SpecifierList} from "./specifier_list";

export class Declaration extends Directive {
    public specifiers: SpecifierList;
    public initDeclarators: InitDeclarator[];

    constructor(location: SourceLocation, specifiers: SpecifierList, initDeclarators: InitDeclarator[]) {
        super(location);
        this.specifiers = specifiers;
        this.initDeclarators = initDeclarators;
    }

    public declare(ctx: CompileContext, classType: ClassType): void {
        const type = this.specifiers.getType(ctx);
        const isTypedef = this.specifiers.specifiers.includes("typedef");
        for (const declarator of this.initDeclarators) {
            if (isTypedef) {
                const name = declarator.declarator.getNameRequired().getPlainName(ctx);
                new UsingStatement(this.location, Identifier.fromString(this.location, name),
                    new TypeName(this.location, this.specifiers, declarator.declarator)).codegen(ctx);
            } else {
                declarator.declareInClass(ctx, {
                    type,
                    isLibCall: this.specifiers.specifiers.includes("__libcall"),
                    isExtern: this.specifiers.specifiers.includes("extern"),
                    isStatic: this.specifiers.specifiers.includes("static"),
                    accessControl: classType.accessControl,
                }, classType);
            }
        }
    }

    public codegen(ctx: CompileContext): void {
        const type = this.specifiers.getType(ctx);
        const isTypedef = this.specifiers.specifiers.includes("typedef");
        for (const declarator of this.initDeclarators) {
            if (isTypedef) {
                const name = declarator.declarator.getNameRequired().getPlainName(ctx);
                new UsingStatement(this.location, Identifier.fromString(this.location, name),
                    new TypeName(this.location, this.specifiers, declarator.declarator)).codegen(ctx);
            } else {
                const isInClass = ctx.scopeManager.currentContext.scope.classType !== null;
                declarator.declare(ctx, {
                    type,
                    isLibCall: this.specifiers.specifiers.includes("__libcall"),
                    isExtern: this.specifiers.specifiers.includes("extern"),
                    isStatic: this.specifiers.specifiers.includes("static"),
                    accessControl: isInClass ? AccessControl.Unknown : AccessControl.Public,
                });
            }
        }
    }

    public getTypedefName(): string[] {
        if (this.specifiers.specifiers.includes("typedef")) {
            return this.initDeclarators.map((decl) => decl.declarator.getNameRequired())
                .map((x) => x.getLastID().name);
        } else {
            return [];
        }
    }
}
