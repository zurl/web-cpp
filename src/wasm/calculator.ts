/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import {RuntimeError} from "../common/error";
import {
    BinaryOperator,
    F32Binary,
    F32Unary,
    F64Binary,
    I32Binary,
    I32Unary,
    I64Binary,
    UnaryOperator,
} from "./constant";

export function doUnaryCompute(ope: UnaryOperator, value: number): number {
    switch (ope) {
        case F32Unary.abs:
            return Math.abs(value);
        case F32Unary.ceil:
            return Math.ceil(value);
    }
    throw new RuntimeError(`unsupport operator`);
}

export function doBinaryCompute(ope: BinaryOperator, lhs: number, rhs: number): number {
    switch (ope) {
        case I32Binary.add:
        case I64Binary.add:
        case F32Binary.add:
        case F64Binary.add:
            return lhs + rhs;
        case I32Binary.sub:
        case I64Binary.sub:
        case F32Binary.sub:
        case F64Binary.sub:
            return lhs - rhs;
        case I32Binary.mul:
        case I64Binary.mul:
        case F32Binary.mul:
        case F64Binary.mul:
            return lhs * rhs;
        case I32Binary.div_s:
        case I64Binary.div_s:
        case I32Binary.div_u:
        case I64Binary.div_u:
        case F32Binary.div:
        case F64Binary.div:
            return lhs / rhs;
        case I32Binary.rem_s:
        case I64Binary.rem_s:
        case I32Binary.rem_u:
        case I64Binary.rem_u:
            return lhs % rhs;
    }
    throw new RuntimeError(`unsupport operator`);
}
