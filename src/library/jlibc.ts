/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 02/07/2018
 */
import {VirtualMachine} from "../vm";

const __jlibc__memcpy = (vm: VirtualMachine) => {
    const dst = vm.popUint32();
    const src = vm.popUint32();
    const len = vm.popUint32();
    vm.memoryUint8Array.set(new Uint8Array(vm.memory.buffer.slice(src, src + len)), dst);
};

const __jlibc__print_integer = (vm: VirtualMachine) => {
    const val = vm.popUint32();
    console.log(val);
};

export const jlibc_header = `
__libcall void __jlibc__memcpy(void * dst, void * src, unsigned int len);
__libcall void __jlibc__print_integer(int val);
`;

export const jlibc_jsapi = {
    __jlibc__memcpy,
    __jlibc__print_integer,
};
