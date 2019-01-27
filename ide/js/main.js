import * as Poly from 'babel-polyfill';
import * as Ace from "./ace/ace";
import * as AceTomorrow from "./ace/theme-tomorrow"
import * as AceCCpp from "./ace/mode-c_cpp";
import * as AceBeatify from "./ace/ext-beautify";
import * as FileUtil from "./file_util";
import {updateInspector} from "./inspector";
import {getText, loadAllUIText} from "./ui_text";

window.setting = {
    "auto_save_interval": 30,
    "language": 1,
    "cpp": 1,
    "expert": 0,
};

const expert_parent = document.getElementById('expert-parent');

function loadSetting() {
    // load setting from load storage'
    const item = window.localStorage.getItem('setting');
    if(item){
        window.setting = JSON.parse(item);
    }
    if(window.setting.expert){
        expert_parent.style.display = "block";
    } else {
        expert_parent.style.display = "none";
    }
}

loadSetting();

const editor = ace.edit("editor", {
    theme: "ace/theme/tomorrow",
    mode: "ace/mode/c_cpp",
    maxLines: 30,
    minLines: 30,
    autoScrollEditorIntoView: true
});
const Range = ace.require('ace/range').Range;

const var_ins_content = document.getElementById("var-ins-content");
document.getElementById("var-ins-switcter").addEventListener('change', function(e){
     if(e.target.checked){
         var_ins_content.style.height = "400px";
     } else {
         var_ins_content.style.height = "0";
     }

});
const expert_content = document.getElementById("expert-content");
document.getElementById("expert-switcter").addEventListener('change', function(e){
    if(e.target.checked){
        expert_content.style.height = "400px";
    } else {
        expert_content.style.height = "0";
    }
});


function doFormat(){
    const beautify = ace.require("ace/ext/beautify");
    beautify.beautify(editor.session);
}

function selectDiv(divName) {
    document.getElementById(`ui-${divName}`).click();
}

const inputTA = document.getElementById("input-textarea");
const outputTA = document.getElementById("output-textarea");
const messageTA = document.getElementById("message-textarea");



function showMessage(type, message){
    selectDiv("message");
    messageTA.value += `[${getText(type)}] : ${message}\n`;
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

async function downloadCompiler(){
    showMessage("compiler", getText("download_message"));
    return await import("../../src/tools/compiler");
}

function processError(e, CompilerError){
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
    if(window.setting.expert){
        throw e;
    }
}
let compiler = null;
let singleRuntime = null;
let markerId = null;
let isLock = false;
async function runSingleStep(){
    if(isLock) return;
    isLock = true;
    if(!compiler){
        compiler = await downloadCompiler();
    }
    const {JSRuntime, importObj, StringInputFile, compileFile,
        CompilerError, CallbackOutputFile} = compiler;
    if(!singleRuntime){
        outputTA.value = "";
        showMessage("compiler", "cc -o main main.cpp");
        try {
            const obj = compileFile("main.cpp", editor.getValue(), window.setting.cpp);
            if (obj == null) {
                showMessage("runtime", "no compiled object");
                return;
            }
            showMessage("runtime", "run main");
            singleRuntime = new JSRuntime({
                importObjects: importObj,
                program: obj.json,
                scope: obj.scope,
                memorySize: 10 * 65536,
                entryFileName: "main.cpp",
                entry: obj.entry,
                heapStart: obj.heapStart,
                files: [
                    new StringInputFile(inputTA.value),
                    new CallbackOutputFile(x => showOutput(x)),
                    new CallbackOutputFile(x => showOutput(x)),
                ],
            });
            showMessage("runtime", "start debugging");
            singleRuntime.prepareRunSingleStepMode();
            const line = singleRuntime.getCurrentLine();
            editor.scrollToLine(line);
            markerId = editor.getSession().addMarker(new Range(line, 0, line, 3000), "current-line", "fullLine", true);
            updateInspector(singleRuntime);
        }catch(e){
            isLock = false;
            console.log(CompilerError);
            processError(e, CompilerError);
        }
    } else {
        const ret = singleRuntime.runSingleStepMode();
        if (ret) {
            const line = singleRuntime.getCurrentLine();
            if(markerId){
                editor.getSession().removeMarker(markerId);
            }
            editor.scrollToLine(line);
            markerId = editor.getSession().addMarker(new Range(line, 0, line, 3000), "current-line", "fullLine", true);
            updateInspector(singleRuntime);
        } else {
            if(markerId){
                editor.getSession().removeMarker(markerId);
            }
            showMessage("runtime", "code return with code 0");
            selectDiv("output");
            updateInspector(null);
            singleRuntime = null;
        }
    }
    isLock = false;
}

async function run() {
    if(isLock) return;
    isLock = true;
    if(!compiler){
        compiler = await downloadCompiler();
    }
    const {NativeRuntime, importObj, StringInputFile, compileFile,
        CompilerError, CallbackOutputFile} = compiler;
    outputTA.value = "";
    showMessage("compiler", "cc -o main main.cpp");
    try {
        const obj = compileFile("main.cpp", editor.getValue(), window.setting.cpp);
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
        showMessage("runtime", getText("end_message"));
        selectDiv("output");
    }catch(e){
        isLock = false;
        processError(e, CompilerError);
    }
    isLock = false;
}


async function getDebugInfo() {
    if(isLock) return;
    isLock = true;
    if(!compiler){
        compiler = await downloadCompiler();
    }
    const {getDebugSymbols, CompilerError} = compiler;
    outputTA.value = "";
    showMessage("compiler", "cc -o main main.cpp");
    try {
        isLock = false;
        return getDebugSymbols("main.cpp", editor.getValue(), {
            isCpp: window.setting.cpp,
            debug: true,
        });
    }catch(e){
        isLock = false;
        processError(e, CompilerError);
    }
    isLock = false;
}

function doSave(){
    window.localStorage.setItem("code", editor.getValue());
    selectDiv("message");
    showMessage("editor", getText("save_message"));
}

setInterval(doSave, 1000 * window.setting.auto_save_interval); // save per 30 seconds

if( window.localStorage.getItem("code")){
    editor.setValue(window.localStorage.getItem("code"));
}

window.addEventListener('load', function(){
    loadAllUIText();
});


const settingDialog = document.getElementById("setting-dialog");
const settingDialogBody = document.getElementById("setting-dialog-body");
const settings = [
    {
        type: 'toggle',
        name: 'cpp',
    },
    {
        type: 'toggle',
        name: 'language',
    },
    {
        type: 'toggle',
        name: 'expert',
    },
];
function generateSettings(){
    settingDialogBody.innerHTML = settings.map((item) => {
        return `
        <div style="display: flex; justify-content: space-between; padding: 10px 0;">
          <span style="width: 60px;" id="ui-setting-${item.name}-left"></span>
          <label style="width: auto;margin: 0 20px;" class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="switch-${item.name}">
              <input type="checkbox" id="switch-${item.name}" class="mdl-switch__input" 
              ${window.setting[item.name] ? "checked" : ""}>
          </label>
          <span style="width: 60px;" id="ui-setting-${item.name}-right"></span>
        </div>
        `
    }).join("\n");
}
generateSettings();
function applySetting() {
    Object.keys(window.setting).map((name) => {
        const item = document.getElementById(`switch-${name}`);
        if(item){
            if(item.type === "checkbox"){
                window.setting[name] = +item.checked;
            }
        }
    });
    window.localStorage.setItem('setting', JSON.stringify(window.setting));
    loadSetting();
    loadAllUIText();
    settingDialog.close();
}

function cancelSetting() {
    settingDialog.close();
}
const expertDialog = document.getElementById("expert-dialog");
const expertDialogBody = document.getElementById("expert-dialog-ta");
async function showDebugInfo(type){
    const info = await getDebugInfo();
    const txt = info[type];
    expertDialogBody.innerHTML = txt;
    expertDialog.showModal()
}

window.run = run;
window.runSingleStep = runSingleStep;
window.doSave = doSave;
window.aceeditor = editor;
window.applySetting = applySetting;
window.cancelSetting = cancelSetting;
window.doFormat = doFormat;
window.showDebugInfo = showDebugInfo;