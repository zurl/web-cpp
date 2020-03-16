import {Directive, SourceLocation} from "../../common/node";

export abstract class Statement extends Directive {
    protected constructor(location: SourceLocation) {
        super(location);
    }
}
