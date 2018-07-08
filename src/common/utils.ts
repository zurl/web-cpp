/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 16/06/2018
 */
import {PrimitiveType, PrimitiveTypesNameMap} from "./type";

export function isArrayEqual(array1: any[], array2: any[]): boolean {
    if (array1.length !== array2.length) {
        return false;
    }
    if (array1.length === 0) {
        return true;
    }
    if (array1[0].equals) {
        for (let i = 0; i < array1.length; i++) {
            if (!array1[i].equals(array2[i])) {
                return false;
            }
        }
        return true;
    } else {
        for (let i = 0; i < array1.length; i++) {
            if (array1[i] !== array2[i]) {
                return false;
            }
        }
        return true;
    }
}

export function getPrimitiveTypeFromSpecifiers(specifierStrings: string[]): PrimitiveType | null {
    for (const [typeSpecifierStringsArray, primitiveType] of PrimitiveTypesNameMap.entries()) {
        for (const typeSpecifierStrings of typeSpecifierStringsArray) {
            if (isArrayEqual(specifierStrings, typeSpecifierStrings)) {
                return primitiveType;
            }
        }
    }
    return null;
}

const typeSpecifierList = ["void", "bool", "char", "long", "int", "unsigned", "signed", "double", "float", "short"];

export function isTypeSpecifier(key: string) {
    return typeSpecifierList.indexOf(key) !== -1;
}

const typeQualifierList = ["const", "volatile"];

export function isTypeQualifier(key: string) {
    return typeQualifierList.indexOf(key) !== -1;
}

const hexchr = "0123456789ABCDEF";

export function toHexString(value: number) {
    let result = "";
    for (let i = 0; i < 8; i++) {
        result = hexchr.charAt(value % 16) + result;
        value = parseInt((value / 16).toString());
    }
    if (result.length === 7) {
        console.log("fuck");
    }
    return "0x" + result;
}

export function fromBytesToString(data: DataView, start: number, size?: number) {
    let result = "";
    if ( size === undefined) {
        let i = start, code = data.getUint8(i);
        while ( code !== 0) {
            result += String.fromCharCode(code);
            i ++;
            code = data.getUint8(i);
        }
    } else {
        for (let i = start; i < start + size; i++) {
            result += String.fromCharCode(data.getUint8(i));
        }
    }
    return result;
}

export function getIndent(indent: number): string {
    let result = "";
    for (let i = 0; i < indent; i++) { result += "\t"; }
    return result;
}
