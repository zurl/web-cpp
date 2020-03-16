/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 02/07/2018
 */

export {Headers, Impls} from "./library";
import * as SysCall from "./syscall";

export const JsAPIMap: { [key: string]: Function } = {...SysCall};
