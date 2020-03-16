const fs = require("fs");
const recursive = require("recursive-readdir");

const libraryPath = "resource/libstdcpp/";
const includePath = libraryPath + "include/";
const cppPath = libraryPath + "lib/";
const outputPath = "src/library/";

async function buildLibrary(){
    const includeFiles = await recursive(includePath);
    const includeContent = includeFiles.map(filePath => ([
        filePath.replace(includePath, ""),
        fs.readFileSync(filePath, "utf-8")
    ]));
    const cppFiles = await recursive(cppPath);
    const cppContent = cppFiles.map(filePath => ([
        filePath.replace(cppPath, ""),
        fs.readFileSync(filePath, "utf-8")
    ]));

    const result =
`/* tslint:disable */
export const Headers = new Map<string, string>(${JSON.stringify(includeContent)});
export const Impls = new Map<string, string>(${JSON.stringify(cppContent)});
`;
    fs.writeFileSync(outputPath + "library.ts", result);
}
buildLibrary().then(x => console.log("build library finish"));