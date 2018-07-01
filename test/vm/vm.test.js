const TestBase = require('./testbase');

describe('vm test cases', function () {
    it('PI32', function () {
        TestBase.testASMCode('PI32 1234', {sp: -4, stop_i32: 1234});
    });
    it('PUI32', function () {
        TestBase.testASMCode('PUI32 1235', {sp: -4, stop_u32: 1235});
        TestBase.testASMCode('PDATA 1236', {sp: -4, stop_u32: 1236});
        TestBase.testASMCode('PBSS 1237', {sp: -4, stop_u32: 1237});
    });
    it('PF64', function () {
        TestBase.testASMCode('PF64 7171.7171', {sp: -8, stop_f64: 7171.7171});
    });
    it('SM', function () {
        TestBase.testASMCode(['PUI32 256', 'PUI32 123', 'SM8'],
            {sp: 0, mem_u32: {addr: 256, val: 123 << 24}});
        TestBase.testASMCode(['PUI32 256', 'PUI32 9999', 'SM8'],
            {sp: 0, mem_u32: {addr: 256, val: (9999 & 0xFF) << 24}});
        TestBase.testASMCode(['PUI32 256', 'PUI32 123', 'SM16'],
            {sp: 0, mem_u32: {addr: 256, val: 123 << 16}});
        TestBase.testASMCode(['PUI32 256', 'PUI32 214000000', 'SM16'],
            {sp: 0, mem_u32: {addr: 256, val: (214000000 & 0xFFFF) << 16}});
        TestBase.testASMCode(['PUI32 256', 'PUI32 7171', 'SM32'],
            {sp: 0, mem_u32: {addr: 256, val: 7171}});
        TestBase.testASMCode(['PUI32 256', 'PUI32 7171', 'PUI32 7172', 'SM64'],
            {sp: 0, mem_u32: [{addr: 256, val: 7171}, {addr: 260, val: 7172}] });
    });
    it('LM', function () {
        const pre = ['PUI32 256', 'PUI32 214000000', 'SM32'];
        TestBase.testASMCode([...pre, 'PUI32 256', 'LM8'],
            {sp: -4, stop_u32: (214000000 & 0xFF000000) >> 24});
        TestBase.testASMCode([...pre, 'PUI32 256', 'LM16'],
            {sp: -4, stop_u32: (214000000 & 0xFFFF0000) >> 16});
        TestBase.testASMCode([...pre, 'PUI32 256', 'LM32'],
            {sp: -4, stop_u32: (214000000 & 0xFFFFFFFF) });
        TestBase.testASMCode([...pre, 'PUI32 256', 'LM64'],
            {sp: -8, stop_u32: (214000000 & 0xFFFFFFFF) });
    });
    it('INT +-*/%', function () {
        const pre = ['PI32 8888', 'PI32 7171'];
        TestBase.testASMCode([...pre, 'ADD'],
            {sp: -4, stop_i32: 8888 + 7171});
        TestBase.testASMCode([...pre, 'SUB'],
            {sp: -4, stop_i32: 8888 - 7171});
        TestBase.testASMCode([...pre, 'MUL'],
            {sp: -4, stop_i32: 8888 * 7171});
        TestBase.testASMCode([...pre, 'DIV'],
            {sp: -4, stop_i32: parseInt(8888 / 7171)});
        TestBase.testASMCode([...pre, 'MOD'],
            {sp: -4, stop_i32: 8888 % 7171});

    });
    it('UINT +-*/%', function () {
        const pre = ['PUI32 8888', 'PUI32 7171'];
        TestBase.testASMCode([...pre, 'ADDU'],
            {sp: -4, stop_i32: 8888 + 7171});
        TestBase.testASMCode([...pre, 'SUBU'],
            {sp: -4, stop_i32: 8888 - 7171});
        TestBase.testASMCode([...pre, 'MULU'],
            {sp: -4, stop_i32: 8888 * 7171});
        TestBase.testASMCode([...pre, 'DIVU'],
            {sp: -4, stop_i32: parseInt(8888 / 7171)});
        TestBase.testASMCode([...pre, 'MODU'],
            {sp: -4, stop_i32: 8888 % 7171});

    });
    it('FLOAT +-*/%', function () {
        const pre = ['PF64 88.88', 'PF64 71.71'];
        TestBase.testASMCode([...pre, 'ADDF'],
            {sp: -8, stop_f64: 88.88 + 71.71});
        TestBase.testASMCode([...pre, 'SUBF'],
            {sp: -8, stop_f64: 88.88 - 71.71});
        TestBase.testASMCode([...pre, 'MULF'],
            {sp: -8, stop_f64: 88.88 * 71.71});
        TestBase.testASMCode([...pre, 'DIVF'],
            {sp: -8, stop_f64: 88.88 / 71.71});
        TestBase.testASMCode([...pre, 'MODF'],
            {sp: -8, stop_f64: 88.88 % 71.71});

    });
});