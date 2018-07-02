/**
 *  @file The c++ compiler JS API
 *  @author zcy <zurl@live.com>
 *  Created at 01/07/2018
 */
import {VirtualMachine} from "../vm";
import {InternalError} from "./error";
import {FunctionType, PointerType, PrimitiveTypes, Type} from "./type";

interface JsAPIDefine {
    impl: (vm: VirtualMachine) => void;
    type: FunctionType;
}

class JsAPIContext {

}

const TypeLookUpTable: {
    [key: string]: Type,
} = {
    void: PrimitiveTypes.void,
    int: PrimitiveTypes.int32,
    double: PrimitiveTypes.double,
    string: new PointerType(PrimitiveTypes.char),
};

function parseFunctionType(define: string): FunctionType | null {
    const l0 = define.split("(");
    if ( l0.length !== 2 ) { return null; }
    if (!TypeLookUpTable.hasOwnProperty(l0[0])) { return null; }
    const returnType = TypeLookUpTable[l0[0]];
    const l1 = l0[1].split(")")[0];
    const l2 = l1.split(",");
    const paramsType = [];
    for (const name of l2) {
        if (!TypeLookUpTable.hasOwnProperty(name)) { return null; }
        paramsType.push(TypeLookUpTable[name]);
    }
    return new FunctionType("", returnType, paramsType, []);
}

function wrapHighAPI(fn: Function, type: FunctionType): (vm: VirtualMachine) => void {
    return (vm: VirtualMachine) => {
        console.log("!");
    };
}

export function defineLowAPI(impl: (vm: VirtualMachine) => void, typeString: string): JsAPIDefine {
    const type = parseFunctionType(typeString);
    if (type === null) {
        throw new InternalError(`Incorrect Low Api Function TYpe ${typeString}`);
    }
    return {
        impl,
        type,
    };
}

export function defineHighAPI(impl: Function, typeString: string): JsAPIDefine {
    const type = parseFunctionType(typeString);
    if (type === null) {
        throw new InternalError(`Incorrect High Api Function TYpe ${typeString}`);
    }
    return {
        impl: wrapHighAPI(impl, type),
        type,
    };
}

export const highlevelapi = defineHighAPI((ctx: JsAPIContext, sb: number): number => {
    return 0;
}, "int(int)");
