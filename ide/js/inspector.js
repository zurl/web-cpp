const tbody = document.getElementById("inspector-tbody");
function escapeHTML( string ) {
    var pre = document.createElement('pre');
    var text = document.createTextNode( string );
    pre.appendChild(text);
    return pre.innerHTML;
}
export function updateInspector(runtime){
    let result = "";
    if(!runtime){
        tbody.innerHTML = "";
        return;
    }
    const stack = runtime.stack;
    for(let i = stack.length - 1; i >= 0; i--){
        const item = stack[i];
        result += `<tr><td colspan="3">==>${escapeHTML(item.fn.displayName)} #${i}</td></tr>`;
        for(const subitem of runtime.getScopeInfo(item.fn.scope, item)){
            if(subitem.name.charAt(0) !== "$") {
                result += `<tr><td>${escapeHTML(subitem.name)}</td><td>${escapeHTML(subitem.type)}</td><td>${escapeHTML(subitem.value)}</td></tr>`;
            }
        }
    }
    result += `<tr><td colspan="3">==>global</td></tr>`;
    for(const subitem of runtime.getScopeInfo(runtime.rootScope, null)){
        result += `<tr><td>${subitem.name}</td><td>${subitem.type}</td><td>${subitem.value}</td></tr>`;
    }
    tbody.innerHTML = result;
}