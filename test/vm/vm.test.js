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
        TestBase.testASMCode(['PUI32 123', 'PUI32 256', 'SM8'],
            {sp: 0, mem_u32: {addr: 256, val: 123 << 24}});
        TestBase.testASMCode(['PUI32 9999','PUI32 256', 'SM8'],
            {sp: 0, mem_u32: {addr: 256, val: (9999 & 0xFF) << 24}});
        TestBase.testASMCode(['PUI32 123', 'PUI32 256', 'SM16'],
            {sp: 0, mem_u32: {addr: 256, val: 123 << 16}});
        TestBase.testASMCode([ 'PUI32 214000000','PUI32 256', 'SM16'],
            {sp: 0, mem_u32: {addr: 256, val: (214000000 & 0xFFFF) << 16}});
        TestBase.testASMCode(['PUI32 7171', 'PUI32 256', 'SM32'],
            {sp: 0, mem_u32: {addr: 256, val: 7171}});
        TestBase.testASMCode(['PUI32 7171', 'PUI32 7172', 'PUI32 256', 'SM64'],
            {sp: 0, mem_u32: [{addr: 256, val: 7171}, {addr: 260, val: 7172}] });
    });
    it('LM', function () {
        const pre = ['PUI32 214000000', 'PUI32 256', 'SM32'];
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
    it('INT && || & | ', function () {
        TestBase.testASMCode(['PI32 1234', 'PI32 1234', 'LAND'],
            {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 0', 'PI32 1234', 'LAND'],
            {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 8888', 'PI32 7777', 'LOR'],
            {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 0', 'PI32 0', 'LOR'],
            {sp: -4, stop_i32: 0});
        const pre = ['PI32 8888', 'PI32 7777'];
        TestBase.testASMCode([...pre, 'AND'],
            {sp: -4, stop_i32: 8888 & 7777});
        TestBase.testASMCode([...pre, 'OR'],
            {sp: -4, stop_i32: 8888 | 7777});
    });
    it('INT >> <<', function () {
        const pre = ['PI32 8888', 'PI32 5'];
        TestBase.testASMCode([...pre, 'SHR'],
            {sp: -4, stop_i32: 8888 >> 5});
        TestBase.testASMCode([...pre, 'SHL'],
            {sp: -4, stop_i32: 8888 << 5});

    });
    it('INT - ! ~', function () {
        TestBase.testASMCode(['PI32 8888', 'NOT'],
            {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 8888', 'INV'],
            {sp: -4, stop_i32: -8889});
        TestBase.testASMCode(['PI32 8888', 'NEG'],
            {sp: -4, stop_i32: -8888});

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
    it('INT > < >= <= == !=', function () {
        TestBase.testASMCode(['PI32 -1', 'GT0'] , {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 0' , 'GT0'] , {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 1' , 'GT0'] , {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 -1', 'GTE0'], {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 0' , 'GTE0'], {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 1' , 'GTE0'], {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 -1', 'LT0'] , {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 0' , 'LT0'] , {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 1' , 'LT0'] , {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 -1', 'LTE0'], {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 0' , 'LTE0'], {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 1' , 'LTE0'], {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 -1', 'EQ0'] , {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 0' , 'EQ0'] , {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 1' , 'EQ0'] , {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 -1', 'NEQ0'], {sp: -4, stop_i32: 1});
        TestBase.testASMCode(['PI32 0' , 'NEQ0'], {sp: -4, stop_i32: 0});
        TestBase.testASMCode(['PI32 1' , 'NEQ0'], {sp: -4, stop_i32: 1});
    });
    it('type convert', function () {
        TestBase.testASMCode(['PF64 12' , 'D2U'] , {sp: -4, stop_u32: 12});
        TestBase.testASMCode(['PUI32 12', 'U2D'] , {sp: -8, stop_f64: 12});
        TestBase.testASMCode(['PF64 12' , 'D2I'] , {sp: -4, stop_i32: 12});
        TestBase.testASMCode(['PI32 12' , 'I2D'] , {sp: -8, stop_f64: 12});
        TestBase.testASMCode(['PF64 12.1' , 'D2F'] , {sp: -4, stop_f32: 12.1});
        TestBase.testASMCode(['PF32 12.1' , 'F2D'] , {sp: -8, stop_f64: 12.1});
    });
    it('PBP & SSP', function () {
        TestBase.testASMCode(['PBP 12'] , {sp: -4, stop_u32: 1012});
        TestBase.testASMCode(['SSP 20'] , {sp: 20});
    });
    it('J JZ JNZ', function () {
        TestBase.testASMCode(['J 10', 'PI32 123', 'PI32 456'],
            {sp: -4, stop_u32: 456});
        TestBase.testASMCode(['PI32 0', 'JZ 10', 'PI32 123', 'PI32 456'],
            {sp: -4, stop_u32: 456});
        TestBase.testASMCode(['PI32 1', 'JZ 10', 'PI32 123', 'PI32 456'],
            {sp: -8, stop_u32: 456});
        TestBase.testASMCode(['PI32 1', 'JNZ 10', 'PI32 123', 'PI32 456'],
            {sp: -4, stop_u32: 456});
        TestBase.testASMCode(['PI32 0', 'JNZ 10', 'PI32 123', 'PI32 456'],
            {sp: -8, stop_u32: 456});
    });
    it('function call', function () {
        TestBase.testASMCode([
                'PUI32 77',
                'CALL 15',
                'PUI32 99'],
            {sp: -12, bp: -12, stop_u32: 1000, mem_u32:[
                    {addr: 996, val: 77},
                    {addr: 992, val: 10},
                    {addr: 988, val: 1000}
                ]});
        TestBase.testASMCode([
                'PUI32 77',     // 0
                'CALL 11',      // 5
                'END',          // 10
                'SSP -12',      // 11 sp -12 -> -24
                'PUI32 9696',   // 16 sp -24 -> -28
                'RET 4'         // 21
            ],
            {pc: 10, sp: -4, bp: 0, stop_u32: 1000 - 28});
        TestBase.testASMCode([
                'PUI32 77',     // 0
                'CALL 11',      // 5
                'END',          // 10
                'SSP -12',      // 11 sp -12 -> -24
                'PUI32 9696',   // 16 sp -24 -> -28
                'RET 0'         // 21
            ],
            {pc: 10, sp: -8, bp: 0, stop_u32: 1000 - 28});
    });
});