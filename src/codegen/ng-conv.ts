import {Type} from "../type";
import {WExpression} from "../wasm";
export class TypeConvertor {
    public type: Type;

    public value: WExpression;

    constructor(type: Type, value: WExpression) {
        this.type = type;
        this.value = value;
    }



}