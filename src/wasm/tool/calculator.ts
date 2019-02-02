/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */
import * as Long from "long";
import {RuntimeError} from "../../common/error";
import {
    BinaryOperator,
    F32Binary,
    F32Unary,
    F64Binary, F64Unary,
    I32Binary,
    I32Unary,
    I64Binary,
    I64Unary,
    UnaryOperator,
} from "./constant";

export function doUnaryCompute(ope: UnaryOperator, value: number): number {
    switch (ope) {
        case F32Unary.abs:
        case F64Unary.abs:
            return Math.abs(value);
        case F32Unary.ceil:
        case F64Unary.ceil:
            return Math.ceil(value);
        case F32Unary.floor:
        case F64Unary.floor:
            return Math.floor(value);
        case F32Unary.nearest:
        case F64Unary.nearest:
            return Math.floor(value + 0.5);
        case F32Unary.trunc:
        case F64Unary.trunc:
            return value | 0;
        case F32Unary.sqrt:
        case F64Unary.sqrt:
            return Math.sqrt(value);
        case I32Unary.eqz:
        case I64Unary.eqz:
            return +(value === 0);
        case F32Unary.neg:
        case F64Unary.neg:
            return -value;

    }
    throw new RuntimeError(`unsupport operator ${ope}`);
}

export function doLongUnaryCompute(ope: UnaryOperator, value: Long): Long {
    switch (ope) {
        case I64Unary.eqz:
            return Long.fromNumber(+(value.eq(0)));
    }
    throw new RuntimeError(`unsupport operator ${ope}`);
}

export function doLongBinaryCompute(ope: BinaryOperator, lhs: Long, rhs: Long): Long {
    switch (ope) {
        case I64Binary.add:
            return lhs.add(rhs);
        case I64Binary.sub:
            return lhs.sub(rhs);
        case I64Binary.mul:
            return lhs.sub(rhs);
        case I64Binary.div_s:
        case I64Binary.div_u:
            return lhs.div(rhs);
        case I64Binary.rem_s:
        case I64Binary.rem_u:
            return lhs.mod(rhs);
        case I64Binary.ge_s:
        case I64Binary.ge_u:
            return Long.fromNumber(+lhs.gte(rhs));
        case I64Binary.gt_s:
        case I64Binary.gt_u:
            return Long.fromNumber(+lhs.gt(rhs));
        case I64Binary.le_s:
        case I64Binary.le_u:
            return Long.fromNumber(+lhs.lte(rhs));
        case I64Binary.lt_s:
        case I64Binary.lt_u:
            return Long.fromNumber(+lhs.lt(rhs));
        case I64Binary.ne:
            return Long.fromNumber(+lhs.neq(rhs));
        case I64Binary.eq:
            return Long.fromNumber(+lhs.eq(rhs));
        case I64Binary.and:
            return lhs.and(rhs);
        case I64Binary.or:
            return lhs.or(rhs);
        case I64Binary.xor:
            return lhs.xor(rhs);
        case I64Binary.shl:
            return lhs.shl(rhs);
        case I64Binary.shr_s:
            return lhs.shr(rhs);
        case I64Binary.shr_u:
            return lhs.shru(rhs);
    }
    throw new RuntimeError(`unsupport operator ${ope}`);
}
export function doBinaryCompute(ope: BinaryOperator, lhs: number, rhs: number): number {
    switch (ope) {
        case I32Binary.add:
        case F32Binary.add:
        case F64Binary.add:
            return lhs + rhs;
        case I32Binary.sub:
        case F32Binary.sub:
        case F64Binary.sub:
            return lhs - rhs;
        case I32Binary.mul:
        case F32Binary.mul:
        case F64Binary.mul:
            return lhs * rhs;
        case I32Binary.div_s:
        case I32Binary.div_u:
        case F32Binary.div:
        case F64Binary.div:
            return lhs / rhs;
        case I32Binary.rem_s:
        case I32Binary.rem_u:
            return lhs % rhs;
        case I32Binary.ge_s:
        case I32Binary.ge_u:
            return +(lhs >= rhs);
        case I32Binary.gt_s:
        case I32Binary.gt_u:
        case F32Binary.gt:
        case F64Binary.gt:
            return +(lhs > rhs);
        case I32Binary.le_s:
        case I32Binary.le_u:
        case F32Binary.le:
        case F64Binary.le:
            return +(lhs <= rhs);
        case I32Binary.lt_s:
        case I32Binary.lt_u:
        case F32Binary.lt:
        case F64Binary.lt:
            return +(lhs < rhs);
        case I32Binary.eq:
        case F32Binary.eq:
        case F64Binary.eq:
            return +(lhs === rhs);
        case I32Binary.ne:
        case F32Binary.ne:
        case F64Binary.ne:
            return +(lhs !== rhs);
        case I32Binary.and:
            return +(lhs & rhs);
        case I32Binary.or:
            return +(lhs | rhs);
        case I32Binary.xor:
            return +(lhs ^ rhs);
        case I32Binary.shl:
            return lhs << rhs;
        case I32Binary.shr_s:
            return lhs >> rhs;
        case I32Binary.shr_u:
            return lhs >>> rhs;
        case F32Binary.copysign:
        case F64Binary.copysign:
            return rhs > 0 ? Math.abs(lhs) : -Math.abs(lhs);
        case F32Binary.max:
        case F64Binary.max:
            return Math.max(lhs, rhs);
        case F32Binary.min:
        case F64Binary.min:
            return Math.min(lhs, rhs);
    }
    throw new RuntimeError(`unsupport operator ${ope}`);
}
