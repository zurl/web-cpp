/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 15/07/2018
 */
import {WNode} from "./node";

export function printWNode(node: any): string {
    let result = node.constructor.name + "{\n";
    for (const x of Object.keys(node)) {
        if ( x === "location") { continue; }
        if ( node[x] instanceof WNode ) {
            result += printWNode(node[x])
                .split("\n").map((y) => "\t" + y)
                .join("\n") + "\n";
        } else if ( node[x] instanceof Array) {
            if (node[x].length === 0) {
                result += `${x}: []\n`;
                continue;
            }
            result += `${x}: [\n`;
            for (const y of node[x]) {
                if ( y instanceof WNode ) {
                    result += printWNode(y)
                        .split("\n").map((z) => "\t" + z)
                        .join("\n") + ",\n";
                } else {
                    result += `y,\n`;
                }
            }
            result += "]\n";
        } else {
            result += `${x} : ${node[x]}\n`;
        }
    }
    result += "}";
    return result;
}
