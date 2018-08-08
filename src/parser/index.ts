import * as fs from "fs";
import * as Long_ from "long";
import * as PegJs from "pegjs";
import * as CTree_ from "../common/ast";
import {Declarator, IdentifierDeclarator, Node, SpecifierType} from "../common/ast";
import {SyntaxError, TypeError} from "../common/error";
import CGrammar from "./c.lang";

const storageClassSpecifierStringToEnum = [
    "typedef", "extern", "static", "_Thread_local", "auto", "register",
];

export function getStorageClassSpecifierFromSpecifiers(specifiers: SpecifierType[],
                                                       nodeForError: Node) {

    const storageClassSpecifiers = [];
    for (const specifier of specifiers) {
        if (typeof(specifier) === "string") {
            if (storageClassSpecifierStringToEnum.includes(specifier)) {
                storageClassSpecifiers.push(specifier);
            }
        }
    }

    // At most, one storage-class specifier may be given in the declaration specifiers in a declaration, except that
    // _Thread_local may appear with static or extern.
    if (!(storageClassSpecifiers.length < 2 || (storageClassSpecifiers.length === 2
        && storageClassSpecifiers.includes("_Thread_local")
        && (storageClassSpecifiers.includes("static")
            || storageClassSpecifiers.includes("extern"))))) {
        throw new TypeError("Multiple storage classes in declaration specifiers", nodeForError);
    }
    // _Thread_local shall not appear in the declaration specifiers of a function declaration.
    // TODO

    if (storageClassSpecifiers.includes("_Thread_local")) {
        throw new TypeError(`Unsupported: '_Thread_local' is not supported`,
            nodeForError);
    }
    if (storageClassSpecifiers.includes("register")) {
        throw new TypeError(`Unsupported: 'register' is not supported`,
            nodeForError);
    }

    return storageClassSpecifiers[0] || null;
}

function getDeclaratorIdentifierName(declarator: Declarator | null): string {
    if ( !declarator ) {
        return "";
    }
    return declarator instanceof IdentifierDeclarator ? declarator.identifier.name
        : getDeclaratorIdentifierName(declarator.declarator);
}

function parseUniversalCharacter(hexSequence: string) {
    // SAFE_NUMBER: At most 0xFFFFFFFF.
    const charCode = Number.parseInt(hexSequence, 16);
    return String.fromCharCode(charCode);
}
const Helper_ = {
    getDeclaratorIdentifierName,
    parseUniversalCharacter,
};

function loadParser(source: string, query: any) {
    const Long = Long_;
    const AST = CTree_;
    const Helper = Helper_;

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
