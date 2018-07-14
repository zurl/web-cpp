/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 14/07/2018
 */

export interface ImportObject {
    [module: string]: {
        [name: string]: Function,
    };
}

export interface Runtime {

}
