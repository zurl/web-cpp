const tbody = document.getElementById("inspector-tbody");

export function updateInspector(runtime){
    let result = "";
    if(!runtime){
        tbody.innerHTML = "";
        return;
    }
    const stack = runtime.stack;
    for(let i = stack.length - 1; i >= 0; i--){
        const item = stack[i];
        result += `<tr><td colspan="3">==>${item.fn.displayName} #${i}</td></tr>`;
        for(const subitem of runtime.getScopeInfo(item.scope)){
            result += `<tr><td>${subitem.name}</td><td>${subitem.type}</td><td>${subitem.value}</td></tr>`;
        }
    }
    result += `<tr><td colspan="3">==>global</td></tr>`;
    for(const subitem of runtime.getScopeInfo(runtime.rootScope)){
        result += `<tr><td>${subitem.name}</td><td>${subitem.type}</td><td>${subitem.value}</td></tr>`;
    }
    tbody.innerHTML = result;
}