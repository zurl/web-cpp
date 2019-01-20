import {SourceLocation} from "../../common/node";
import {Expression} from "./expression";

export abstract class Constant extends Expression {
    constructor(location: SourceLocation) {
        super(location);
    }
}
