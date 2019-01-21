import {InternalError, SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {getPrimitiveTypeFromSpecifiers, isTypeSpecifier} from "../../common/utils";
import {Type} from "../../type";
import {ClassSpecifier} from "../class/class_specifier";
import {EnumSpecifier} from "../class/enum_specifier";
import {CompileContext} from "../context";
import {Identifier} from "../expression/identifier";

export type SpecifierType =
    string
    | Identifier
    | ClassSpecifier
    | EnumSpecifier;

export class SpecifierList extends Node {
    public specifiers: SpecifierType[];

    constructor(location: SourceLocation, specifiers: SpecifierType[]) {
        super(location);
        this.specifiers = specifiers;
    }

    public getType(ctx: CompileContext): Type {
        let resultType: Type | null = null;
        const typeNodes = this.specifiers.filter((x) => typeof(x) !== "string");
        const stringNodes = this.specifiers.filter((x) => typeof(x) === "string") as string[];
        if (typeNodes.length !== 0) {
            if ( typeNodes.length !== 1) {
                throw new SyntaxError(`illegal syntax`, this);
            }
            const node = typeNodes[0];
            if ( node instanceof ClassSpecifier) {
                resultType = node.codegen(ctx);
            } else if ( node instanceof Identifier) {
                resultType = node.deduceType(ctx);
            } else if ( node instanceof EnumSpecifier) {
                resultType = node.codegen(ctx);
            } else {
                throw new InternalError(`unsupport type`);
            }
        } else {
            // primitive types
            const typeNames = stringNodes.filter(isTypeSpecifier).sort();
            resultType = getPrimitiveTypeFromSpecifiers(typeNames);
        }
        if (resultType == null) {
            throw new SyntaxError("Illegal Return Type", this);
        }
        if (stringNodes.indexOf("const") !== -1) {
            resultType.isConst = true;
        }
        return resultType;
    }
}
