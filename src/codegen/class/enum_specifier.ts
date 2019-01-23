import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {AddressType, Variable} from "../../common/symbol";
import {AccessControl} from "../../type";
import {IntegerType, PrimitiveTypes} from "../../type/primitive_type";
import {WConst} from "../../wasm";
import {CompileContext} from "../context";
import {Expression} from "../expression/expression";
import {Identifier} from "../expression/identifier";

export class EnumSpecifier extends Node {
    public identifier: Identifier;
    public enumerators: Enumerator[] | null;

    constructor(location: SourceLocation, identifier: Identifier, enumerators: Enumerator[] | null) {
        super(location);
        this.identifier = identifier;
        this.enumerators = enumerators;
    }

    public codegen(ctx: CompileContext) {
        if (this.enumerators != null) {
            let now = -1, val = 0;
            for (const enumerator of this.enumerators) {
                now++;
                if (enumerator.value === null) {
                    val = now;
                } else {
                    const expr = enumerator.value.codegen(ctx);
                    expr.expr = expr.expr.fold();
                    if (!(expr.expr instanceof WConst) ||
                        !(expr.type instanceof IntegerType)) {
                        throw new SyntaxError(`enum value must be integer`, this);
                    }
                    val = parseInt(expr.expr.constant);
                }
                const shortName = enumerator.identifier.getPlainName(ctx);
                const fullName = enumerator.identifier.getFullName(ctx);
                ctx.scopeManager.declare(shortName, new Variable(
                    shortName, fullName,
                    ctx.fileName, PrimitiveTypes.int32,
                    AddressType.CONSTANT, val, AccessControl.Public,
                ), this);
            }
        }
        if (this.identifier != null) {
            ctx.scopeManager.declare(this.identifier.getLookupName(ctx), PrimitiveTypes.int32, this);
        }
        return PrimitiveTypes.int32;
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
