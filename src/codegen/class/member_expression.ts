import {InternalError, SyntaxError} from "../../common/error";
import {SourceLocation} from "../../common/node";
import {Variable} from "../../common/symbol";
import {Type} from "../../type";
import {ClassType} from "../../type/class_type";
import {LeftReferenceType, ReferenceType} from "../../type/compound_type";
import {UnresolvedFunctionOverloadType} from "../../type/function_type";
import {WConst, WType} from "../../wasm";
import {WAddressHolder} from "../address";
import {CompileContext} from "../context";
import {doReferenceTransform} from "../conversion";
import {Expression, ExpressionResult} from "../expression/expression";
import {Identifier} from "../expression/identifier";
import {UnaryExpression} from "../expression/unary_expression";
import {FunctionLookUpResult} from "../scope";

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

    public codegen(ctx: CompileContext): ExpressionResult {

        const memberName = this.member.getPlainName(ctx);

        let left = this.pointed ?
            new UnaryExpression(this.location, "*", this.object).codegen(ctx)
            : this.object.codegen(ctx);

        const isRef = left.type instanceof ReferenceType;

        left = doReferenceTransform(ctx, left, this);

        if (!(left.isLeft && left.expr instanceof WAddressHolder)) {
            throw new InternalError(`unsupport rvalue of member expression`);
        }

        if (!(left.type instanceof ClassType)) {
            throw new SyntaxError(`only struct/class could be get member`, this);
        }

        const item = left.type.getMember(ctx, memberName);

        if ( item === null ) {
            throw new SyntaxError(`name ${this.member.name} is not on class ${left.type.shortName}`, this);
        } else if (item instanceof Variable) {
            // static field
            return {
                type: item.type,
                expr: new WAddressHolder(item.location, item.addressType, this.location),
                isLeft: true,
            };
        } else if (item instanceof FunctionLookUpResult) {
            item.instance = left.expr;
            item.instanceType = left.type;
            if (this.pointed || isRef) {
                if ( memberName.includes("~") ) {
                    item.isDynamicCall = this.forceDynamic;
                } else {
                    item.isDynamicCall = true;
                }
            }
            return {
                type: new UnresolvedFunctionOverloadType(item),
                expr: new WConst(WType.any, "0"),
                isLeft: false,
            };
        } else {
            return {
                isLeft: true,
                type: item.type,
                expr: left.expr.makeOffset(item.startOffset),
            };
        }
    }

    public deduceType(ctx: CompileContext): Type {

        const memberName = this.member.getPlainName(ctx);

        const left = this.pointed ?
            new UnaryExpression(this.location, "*", this.object).deduceType(ctx)
            : this.object.deduceType(ctx);

        const isRef = left instanceof ReferenceType;
        let rawType = left;
        if ( rawType instanceof LeftReferenceType) {
            rawType = rawType.elementType;
        }
        if ( !(rawType instanceof ClassType)) {
            throw new SyntaxError(`only struct/class could be get member`, this);
        }
        const item = rawType.getMember(ctx, memberName);

        if ( item === null ) {
            throw new SyntaxError(`name ${this.member.getLookupName(ctx)} is not on class ${rawType.shortName}`, this);
        } else if (item instanceof Variable) {
            // static field
            return item.type;
        } else if (item instanceof FunctionLookUpResult) {
            item.instanceType = rawType;
            if (this.pointed || isRef) {
                if ( memberName.includes("~") ) {
                    item.isDynamicCall = this.forceDynamic;
                } else {
                    item.isDynamicCall = true;
                }
            }
            return new UnresolvedFunctionOverloadType(item);
        } else {
            return item.type;
        }
    }
}
