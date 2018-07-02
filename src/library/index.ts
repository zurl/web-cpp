/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 02/07/2018
 */

import {JsAPIDefine} from "../common/jsapi";
import {jlibc_header, jlibc_jsapi} from "./jlibc";

export const JsAPIMap: { [key: string]: JsAPIDefine } = {
    ...jlibc_jsapi,
};

export const Headers: { [key: string]: string } = {
    jlibc_header,
};
