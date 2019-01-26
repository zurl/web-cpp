import FileSaver from "file-saver"

function selectFile(accept) {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', accept);
        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                resolve(file);
            }
        };
        input.click();
    })
}
function isCFile(file) {
    return file.name.endsWith('.h') || file.name.endsWith('.c')
        || file.name.endsWith('.cpp') || file.name.endsWith('.hpp')
        || file.name.endsWith('.cc');
}

function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e.target.error);
        reader.readAsText(file);
    });
}

function readFile(file) {
    if (!isCFile(file)) {
        if (!confirm(ui("not-c-message"))) {
            return;
        }
    }
    if (file.size > 1024 * 1024) {
        if (!confirm(ui("large-file-message"))) {
            return;
        }
    }
    return readTextFile(file)
        .then(text => {
            window.aceeditor.setValue(text);
        })
        .catch(e => alert('打开文件失败：\n' + ((e && e.message) || '未知错误。')));
}

function getCFileAccept() {
    return '.h,.c,.cpp,.hpp,.cc';
}

function doFileOpen(){
    const oldValue = window.aceeditor.getValue();
    if (oldValue.trim() &&
        window.localStorage.getItem("code") !== oldValue){
        if (!confirm(ui("confirm-message"))) {
            return;
        }
    }
    selectFile(getCFileAccept()).then(file => readFile(file));
}
function saveTextFile(text, name, type) {
    return FileSaver.saveAs(new Blob([text], { type }), name, true);
}

function doFileDownload(){
    saveTextFile(window.aceeditor.getValue(), window.setting.cpp ? 'a.cpp' : 'a.c', 'text/x-chdr');
}

window.doFileOpen = doFileOpen;
window.doFileDownload = doFileDownload;
