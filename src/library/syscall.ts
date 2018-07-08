/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 08/07/2018
 */
import {RuntimeError} from "../common/error";
import {VirtualMachine} from "../vm";

export function write(vm: VirtualMachine): void {
    const fd = vm.popUint32();
    const ptr = vm.popUint32();
    const size = vm.popUint32();
    if (fd >= vm.files.length) {
        vm.pushInt32(-1);
        return;
    }
    const file = vm.files[fd];
    const cnt = file.write(vm.memory.buffer.slice(ptr, ptr + size));
    vm.pushInt32(cnt);
}

export function read(vm: VirtualMachine): void {
    const fd = vm.popUint32();
    const ptr = vm.popUint32();
    const size = vm.popUint32();
    if (fd >= vm.files.length) {
        vm.pushInt32(-1);
        return;
    }
    const file = vm.files[fd];
    const cnt = file.read(vm.memory.buffer, ptr, size);
    vm.pushInt32(cnt);
}

const printfBuffer = new ArrayBuffer(1000);
const printfView = new DataView(printfBuffer);

export function printf(vm: VirtualMachine): void {
    let formatptr = vm.popUint32();
    let argleft = vm.popUint32();
    let chr = vm.memory.getUint8(formatptr);
    let size = 0;
    while ( chr !== 0) {
        if ( chr === "%".charCodeAt(0)) {
            formatptr ++;
            const chr2 = String.fromCharCode(vm.memory.getUint8(formatptr));
            if (chr2 === "%") {
                printfView.setUint8(size, "%".charCodeAt(0));
            } else if (chr2 === "d") {
                const str = vm.popInt32().toString();
                for (let j = 0; j < str.length; j++) {
                    printfView.setUint8(size, str.charCodeAt(j));
                    size++;
                }
                argleft -= 4;
            } else if (chr2 === "s") {
                let strptr = vm.popUint32();
                let strchr = vm.memory.getUint8(strptr);
                while (strchr !== 0) {
                    vm.memory.setUint8(size, strchr);
                    size ++;
                    strptr++;
                    strchr = vm.memory.getUint8(strptr);
                }
                argleft -= 4;
            } else {
                printfView.setUint8(size, "%".charCodeAt(0));
                size++;
                printfView.setUint8(size, chr2.charCodeAt(0));
                size ++;
            }
        } else {
            printfView.setUint8(size, chr);
            size ++;
        }
        formatptr ++;
        chr = vm.memory.getUint8(formatptr);
    }
    const file = vm.files[1];
    const cnt = file.write(printfBuffer.slice(0, size));
    if ( argleft !== 0 && vm.strictMode) {
        throw new RuntimeError(`printf arg is not correct`);
    }
    vm.pushInt32(cnt);
}
