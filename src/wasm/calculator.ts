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
    I64Binary, I64Unary,
    UnaryOperator,
} from "./constant";

export function doUnaryCompute(ope: UnaryOperator, value: number): number {
    switch (ope) {
        case F32Unary.abs:
            return Math.abs(value);
        case F32Unary.ceil:
            return Math.ceil(value);
        case I32Unary.eqz:
        case I64Unary.eqz:
            return +(value === 0);
    }
    throw new RuntimeError(`unsupport operator ${ope}`);
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
        case I32Binary.ge_s:
        case I64Binary.ge_s:
        case I32Binary.ge_u:
        case I64Binary.ge_u:
            return +(lhs >= rhs);
        case I32Binary.gt_s:
        case I64Binary.gt_s:
        case I32Binary.gt_u:
        case I64Binary.gt_u:
        case F32Binary.gt:
        case F64Binary.gt:
            return +(lhs > rhs);
        case I32Binary.le_s:
        case I64Binary.le_s:
        case I32Binary.le_u:
        case I64Binary.le_u:
        case F32Binary.le:
        case F64Binary.le:
            return +(lhs <= rhs);
        case I32Binary.lt_s:
        case I64Binary.lt_s:
        case I32Binary.lt_u:
        case I64Binary.lt_u:
        case F32Binary.lt:
        case F64Binary.lt:
            return +(lhs < rhs);
        case I32Binary.eq:
        case I64Binary.eq:
        case F32Binary.eq:
        case F64Binary.eq:
            return +(lhs === rhs);
        case I32Binary.ne:
        case I64Binary.ne:
        case F32Binary.ne:
        case F64Binary.ne:
            return +(lhs !== rhs);
        case I32Binary.and:
        case I64Binary.and:
            return +(lhs & rhs);
        case I32Binary.or:
        case I64Binary.or:
            return +(lhs | rhs);
        case I32Binary.xor:
        case I64Binary.xor:
            return +(lhs ^ rhs);

    }
    throw new RuntimeError(`unsupport operator ${ope}`);
}
