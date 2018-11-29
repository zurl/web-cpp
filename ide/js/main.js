import * as Poly from 'babel-polyfill';
import * as Ace from "./ace/ace";
import * as AceTomorrow from "./ace/theme-tomorrow"
import * as AceCCpp from "./ace/mode-c_cpp";
import {version} from "./version";
document.getElementById("version-text").innerText = "v" + version;

const editor = ace.edit("editor", {
    theme: "ace/theme/tomorrow",
    mode: "ace/mode/c_cpp",
    maxLines: 30,
    minLines: 30,
    autoScrollEditorIntoView: true
});

const var_ins_content = document.getElementById("var-ins-content");
document.getElementById("var-ins-switcter").addEventListener('change', function(e){
     if(e.target.checked){
         var_ins_content.style.height = "400px";
     } else {
         var_ins_content.style.height = "0";
     }
});

function selectDiv(divName) {
    document.getElementById(`${divName}-href`).click();
}

const inputTA = document.getElementById("input-textarea");
const outputTA = document.getElementById("output-textarea");
const messageTA = document.getElementById("message-textarea");



function showMessage(type, message){
    selectDiv("message");
    messageTA.value += `[${type}] : ${message}\n`;
    messageTA.scrollTop = 1000000;
}

function showError(error){
    selectDiv("message");
    messageTA.value += error.toString() + "\n";
    messageTA.value += ">> " + error.errorLine + "\n";
    messageTA.scrollTop = 1000000;
}

function showOutput(message){
    outputTA.value += message;
}

let isFirst = true;

function reportError(errorJson){
    fetch('http://er.zhangcy.cn/report', {
        body: JSON.stringify({
            "ua": navigator.userAgent,
            "code" : errorJson.source,
            "error" :errorJson.error,
        }), // must match 'Content-Type' header
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        headers: {
            'user-agent': 'Mozilla/4.0 MDN Example',
            'content-type': 'application/json'
        },
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, cors, *same-origin
    });
}

async function run() {
    outputTA.value = "";
    if(isFirst){
        showMessage("compiler", "downloading compiler");
        isFirst = false;
    }
    const {NativeRuntime, importObj, StringInputFile, compileFile, CompilerError, CallbackOutputFile} = await import("../../src/tools/compiler");
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
            memorySize: 10 * 65536,
            entry: obj.entry,
            heapStart: obj.heapStart,
            files: [
                new StringInputFile(inputTA.value),
                new CallbackOutputFile(x => showOutput(x)),
                new CallbackOutputFile(x => showOutput(x)),
            ],
        });
        selectDiv("output");
        // todo::
        await runtime.run();
        showMessage("runtime", "code return with code 0");
        selectDiv("output");
    }catch(e){
        let errorjson = {};
        if( e instanceof CompilerError ) {
            errorjson = {
                type: 'ce',
                error: e.toString(),
                errorLine: e.errorLine,
                source: editor.getValue()
            };
            showError(e);
        }
        else {
            errorjson = {
                type: 'oe',
                error: e.toString(),
                source: editor.getValue()
            };
            showMessage("error", e.toString());
        }
        reportError(errorjson);
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
