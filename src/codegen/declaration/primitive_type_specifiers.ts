import {SyntaxError} from "../../common/error";
import {Node, SourceLocation} from "../../common/node";
import {getPrimitiveTypeFromSpecifiers} from "../../common/utils";
export class PrimitiveTypeSpecifiers extends Node {
    public tokens: string[];

    constructor(location: SourceLocation, tokens: string[]) {
        super(location);
        this.tokens = tokens;
    }

    public toString() {
        const result = getPrimitiveTypeFromSpecifiers(this.tokens);
        if (!result) {
            throw new SyntaxError(`${this.tokens.join(" ")} is not type`, this);
        }
        return result.toMangledName();
    }
}
