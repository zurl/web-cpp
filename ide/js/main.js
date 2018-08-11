import * as Poly from 'babel-polyfill';
import * as Ace from "./ace/ace";
import * as AceMonokai from "./ace/theme-monokai"
import * as AceCCpp from "./ace/mode-c_cpp";
import {version} from "./version";

const messageDiv = document.getElementById("message");
const outputDiv = document.getElementById("output");
const inputTa = document.getElementById("input-ta");
const editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/c_cpp");

const tabdiv = M.Tabs.init(document.getElementById("tab-div"), {});
document.getElementById("version-text").innerText = "v" + version;

let obj = null;

function showMessage(type, message){
    tabdiv.select("message");
    const line = document.createElement("div");
    line.innerText = `[${type}] : ${message}`;
    messageDiv.appendChild(line);
    messageDiv.scrollTop = 1000000;
}

function showError(error){
    tabdiv.select("message");
    const line = document.createElement("div");
    line.innerText = error.toString();
    messageDiv.appendChild(line);
    const line2 = document.createElement("div");
    line2.innerText = ">> " + error.errorLine;
    messageDiv.appendChild(line2);
    messageDiv.scrollTop = 1000000;
}

function showOutput(message){
    outputDiv.innerText += message;
}

let isFirst = true;
async function run() {
    outputDiv.innerText = "";
    if(isFirst){
        showMessage("compiler", "downloading compiler");
        isFirst = false;
    }
    const {NativeRuntime, importObj,StringInputFile, compileFile,CompilerError, CallbackOutputFile} = await import("../../src/tools/compiler");
    showMessage("compiler", "cc -o main main.cpp");
    try {
        const obj = compileFile("main.cpp", editor.getValue());
        if (obj == null) {
            showMessage("runtime", "no compiled object");
            return;
        }
        showMessage("runtime", "run main");
        const runtime = new NativeRuntime({
            importObjects: importObj,
            code: obj.binary,
            memorySize: 10,
            entry: obj.entry,
            heapStart: obj.heapStart,
            files: [
                new StringInputFile(inputTa.value),
                new CallbackOutputFile(x => showOutput(x)),
                new CallbackOutputFile(x => showOutput(x)),
            ],
        });
        tabdiv.select("output");
        await runtime.run();
        showMessage("runtime", "code return with code 0");
        tabdiv.select("output");
    }catch(e){
        if( e instanceof CompilerError ) {
            gtag('event', 'exception', {
                'description': JSON.stringify({
                    error: e.toString(),
                    errorLine: e.errorLine,
                    source: editor.getValue()
                }),
                'fatal': false
            });
            showError(e);
        }
        else {
            gtag('event', 'exception', {
                'description': JSON.stringify({
                    error: e.toString(),
                    source: editor.getValue()
                }),
                'fatal': false
            });
            showMessage("error", e.toString());
        }
    }
}

function doSave(){
    window.localStorage.setItem("code", editor.getValue());
}
window.run = run;
window.doSave = doSave;

setInterval(doSave, 1000 * 15); // save per 15 seconds

if( window.localStorage.getItem("code")){
    editor.setValue(window.localStorage.getItem("code"));
}
