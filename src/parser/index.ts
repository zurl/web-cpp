import * as fs from "fs";
import * as Long_ from "long";
import * as PegJs from "pegjs";
import {SyntaxError, TypeError} from "../common/error";
import {Node} from "../common/node";
import * as CTree_ from "./ast";
import CGrammar from "./c.lang";

function parseUniversalCharacter(hexSequence: string) {
    // SAFE_NUMBER: At most 0xFFFFFFFF.
    const charCode = Number.parseInt(hexSequence, 16);
    return String.fromCharCode(charCode);
}
const Helper_ = {
    parseUniversalCharacter,
};

function loadParser(source: string, query: any) {
    const Long = Long_;
    const AST = CTree_;

    // cache
    if ((global as any)["window"] === undefined && fs.existsSync("/tmp/" + query.parserName + ".js")) {
        const newCode = fs.readFileSync("/tmp/" + query.parserName + ".js", "utf8");
        // if( "TranslationUnitPegParser" !== query.parserName)
        // return eval(newCode);
    }
    source = source.replace(/&!'((\\.|[^'])*)'/g, (match,
                                                   rule) => `(expected:'${rule}'? {
        if (!expected) {${rule.includes("}") ? "/*{*/" : ""}
            error('Missing \\\'${rule}\\\'');
        }
        return expected;
    })`);
    query.output = "source";
    query.cache = !!query.cache;
    query.optimize = query.optimize || "speed";
    query.trace = !!query.trace;
    if (typeof query.allowedStartRules === "string") {
        query.allowedStartRules = [query.allowedStartRules];
    }

    const code = PegJs.generate(source, query);
    // if ((global as any)["window"] === undefined) {
    //     console.log("fuck");
    //     fs.writeFileSync("/tmp/" + query.parserName + ".js", code);
    // }
    return eval(code as any);
}

const ConstantExpressionPegParser = loadParser(CGrammar,
    {parserName: "ConstantExpression", allowedStartRules: "ConstantExpression"});
const TranslationUnitPegParser = loadParser(CGrammar,
    {parserName: "TranslationUnitPegParser"});

function wrapPegParser(parser: any) {
    return {
        parse(source: string, options: any) {
            try {
                return parser.parse(source, options);
            } catch (e) {
                if (e instanceof parser.SyntaxError) {
                    throw new SyntaxError(e.message, {
                        location: e.location as any,
                    } as Node);
                } else {
                    throw e;
                }
            }
        },
    };
}

export const ConstantExpressionParser = wrapPegParser(ConstantExpressionPegParser);
export const CParser = wrapPegParser(TranslationUnitPegParser);
