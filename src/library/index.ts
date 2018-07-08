/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 02/07/2018
 */
import {JsAPIDefine} from "../common/jsapi";

export {Headers, Impls} from "./library";
import * as SysCall from "./syscall";

export const JsAPIMap: { [key: string]: JsAPIDefine } = {...SysCall};
