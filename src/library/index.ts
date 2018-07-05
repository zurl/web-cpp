/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 02/07/2018
 */

import {JsAPIDefine} from "../common/jsapi";
import {jlibc_header, jlibc_jsapi} from "./jlibc";
import {string_h, string_impl} from "./stdc/string";

export const JsAPIMap: { [key: string]: JsAPIDefine } = {
    ...jlibc_jsapi,
};

export const Headers: { [key: string]: string } = {
    jlibc_header,
    "string.h" : string_h,
};

export const Impls: { [key: string]: string } = {
    "string.h" : string_impl,
};
