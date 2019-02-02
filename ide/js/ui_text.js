// the ui_text of web-cpp ide
import {version} from "./version";


const UI_TEXT = {
    "title": [
        "C/C++ Compiler in Browser",
        "C/C++ 在线开发环境"
    ],
    "version": [
        "v" + version,
        "v" + version
    ],
    "inspector":[
        "Variables Inspector",
        "变量检查"
    ],
    "key":["key", "变量名"],
    "type":["type", "类型"],
    "value":["value", "值"],
    "input":["input", "输入"],
    "output":["value", "输出" ],
    "message":["message", "消息"],
    "download_message":[
        "downloading compiler",
        "正在下载编译器"
    ],
    "save_message":[
        "code have been saved",
        "代码已被保存"
    ],
    "end_message":[
        "the execution of code have been ended",
        "程序运行结束"
    ],
    "runtime":[
        "runtime","运行时"
    ],
    "editor":[
        "editor","编辑器"
    ],
    "compiler":[
        "compiler","编译器"
    ],
    "error":[
        "error", "错误"
    ],
    "run":[
        "Run","运行"
    ],
    "setting":[
        "Setting","设置"
    ],
    "save":[
        "Save", "保存"
    ],
    "setting-title":[
        "Setting Panel","设置面板"
    ],
    "setting-apply":[
        "apply","应用"
    ],
    "setting-discard":[
        "discard","取消"
    ],
    "setting-cpp-left":[
        "C", "C"
    ],
    "setting-cpp-right":[
        "C++", "C++"
    ],
    "setting-language-left":[
        "English", "English"
    ],
    "setting-language-right":[
        "简体中文", "简体中文"
    ],
    "setting-expert-left":[
        "Normal mode", "普通模式"
    ],
    "setting-expert-right":[
        "Expert mode", "专家模式"
    ],
    "menu":[
        "Menu", "菜单"
    ],
    "confirm-message":[
        "You have unsaved changes, do you want to open new file?",
        "您有尚未保存的更改，确定要打开新的文件吗？"
    ],
    "not-c-message":[
        'This file is not C/C++ file, do you want to open?',
        '这个文件似乎不是 C/C++ 语言文件，确定要打开吗？'
    ],
    "large-file-message":[
        "This file is larger than 1MB, do you want to open?",
        '这个文件大于 1 MiB，确定要打开吗？'
    ],
    "file-open":[
        "Open File",
        "打开文件"
    ],
    "file-download":[
        "Download File",
        "下载文件"
    ],
    "expert-dialog-title":[
        "Expert Mode",
        "专家模式",
    ],
    "expert-switch":[
        "Expert Mode Options",
        "专家模式选项",
    ],
    "expert-dialog-close":[
        "Close",
        "关闭",
    ],
    "expert-asm-btn":[
        "Show Web Assembly",
        "显示汇编代码(WebAssembly)"
    ],
    "expert-pre-btn":[
        "Show Preprocessed Code",
        "显示预处理后的代码"
    ]
};

export function loadAllUIText(){
    Object.keys(UI_TEXT).map((field) => {
        const item = document.getElementById("ui-" + field);
        if(item) {
            item.innerText = UI_TEXT[field][window.setting.language];
        }
    });
}

export function getText(field){
    return UI_TEXT[field][window.setting.language];
}