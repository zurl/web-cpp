import {BinaryObject, CompiledObject} from "../common/object";
/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/07/2018
 */

export interface LinkOptions {
    fileName: string;
    debug?: boolean;
}

// export function merge(objects: CompiledObject[]): CompiledObject{
//     // TODO::
// }

export function link(objects: CompiledObject[], option: LinkOptions): BinaryObject {

}
