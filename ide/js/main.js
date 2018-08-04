import * as Poly from 'babel-polyfill';
import * as Ace from "./ace/ace";
import * as AceMonokai from "./ace/theme-monokai"
import * as AceCCpp from "./ace/mode-c_cpp";
import {StringInputFile} from "../../src/runtime/vmfile";

const messageDiv = document.getElementById("message");
const outputDiv = document.getElementById("output");
const inputTa = document.getElementById("input-ta");
const editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/c_cpp");

const tabdiv = M.Tabs.init(document.getElementById("tab-div"), {});
document.getElementById("version").innerText = "v0.1.0";

let obj = null;

function showMessage(type, message){
    const line = document.createElement("div");
    line.innerText = `[${type}] : ${message}`;
    messageDiv.appendChild(line);
    messageDiv.scrollTop = 1000000;
}

function showOutput(message){
    outputDiv.innerText += message;
}

async function run() {
    outputDiv.innerText = "";
    tabdiv.select("message");
    showMessage("compiler", "cc -o main main.cpp");
    const {NativeRuntime, importObj,StringInputFile, compileFile, CallbackOutputFile, NoInputFile} = await import("../../src/tools/api_tools");
    try {
        const obj = compileFile("main.cpp", editor.getValue());
        if (obj == null) {
            showMessage("runtime", "no compiled object");
            return;
        }
        showMessage("runtime", "run main");
        const runtime = new NativeRuntime(obj.binary, 10, obj.entry, importObj, [
            new StringInputFile(inputTa.value),
            new CallbackOutputFile(x => showOutput(x)),
            new CallbackOutputFile(x => showOutput(x)),
        ]);
        tabdiv.select("output");
        await runtime.run();
        showMessage("runtime", "function execution finished");
    }catch(e){
        tabdiv.select("message");
        showMessage("error", e.toString());
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
