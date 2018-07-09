#! /usr/bin/env node
const LocalTools = require("./dist/tools/local_tools");

function showHelp(){
    console.log("Usage: ./cc compile file.cpp file.bin");
    console.log("       ./cc run file.bin")
    process.exit(0);
}

if(process.argv.length <= 2){
    showHelp();
}

const command = process.argv[2];

if( command === "run" ){
    if(process.argv <= 3){
        showHelp();
    }
    if(process.argv[3].includes(".cpp")){
        const binary = LocalTools.compileFile(process.argv[3]);
        LocalTools.runFile(binary, 50000);
    } else {
        const binary = LocalTools.loadBinaryFile(process.argv[3]);
        LocalTools.runFile(binary, 50000);
    }
} else if( command === "compile"){
    if(process.argv <= 4){
        showHelp();
    }
    const binary = LocalTools.compileFile(process.argv[3]);
    LocalTools.saveBinaryFile(process.argv[4], binary);
} else {
    showHelp();
}