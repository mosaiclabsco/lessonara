const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('annotationOverlay',Object.freeze({
 onTool:callback=>ipcRenderer.on('overlay:tool',(_event,value)=>callback(value)),
 onTextSize:callback=>ipcRenderer.on('overlay:text-size',(_event,value)=>callback(value)),
 textSize:value=>ipcRenderer.send('overlay:text-size',value),
 onColor:callback=>ipcRenderer.on('overlay:color',(_event,value)=>callback(value)),
 onClear:callback=>ipcRenderer.on('overlay:clear',()=>callback()),
 onUndo:callback=>ipcRenderer.on('overlay:undo',()=>callback()),
 onState:callback=>ipcRenderer.on('overlay:state',(_event,value)=>callback(value)),
 settings:()=>ipcRenderer.invoke('overlay:settings'),
 select:tool=>ipcRenderer.send('overlay:select',tool),color:value=>ipcRenderer.send('overlay:color',value),
 clear:()=>ipcRenderer.send('overlay:clear'),undo:()=>ipcRenderer.send('overlay:undo'),stop:()=>ipcRenderer.send('overlay:stop'),
}));
