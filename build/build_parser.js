const fs = require("fs");
const recursive = require("recursive-readdir");

const grammarPath = "resource/grammar/";
const outputPath = "src/parser/";

async function buildLibrary(minifiy){
    const originalGrammarFiles = await recursive(grammarPath);
    const grammarFiles = [
        ...originalGrammarFiles.filter(x => x.includes("header")),
        ...originalGrammarFiles.filter(x => !x.includes("header"))
    ];
    const grammarContent = grammarFiles
        .map(filePath => fs.readFileSync(filePath, "utf-8"))
        .join("\n");

    const newContent = minifiy ? grammarContent
        .replace(/\/\/.*\n/g, "")
        .replace(/\/\*.*\*\//g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/(?<=[={*+?/,])\s/g, "")
        .replace(/\s+(?=[(){}\[\]*+?:=,/])/g, "")
        .replace(/\n\s+/g, "\n")
        : grammarContent;

    const result =
        `/* tslint:disable */
// generate from resource/grammar        
export default \`${newContent}\`        
`;
    fs.writeFileSync(outputPath + "c.lang.ts", result);
}
buildLibrary(false).then(_ => console.log("build parser finish"));