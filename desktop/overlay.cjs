const {BrowserWindow,screen,ipcMain}=require('electron');
const path=require('node:path');const {pathToFileURL}=require('node:url');
const palette=require('./annotation-palette.json');
const tools=new Set([null,'pen','laser','text','eraser','select']);
function setupOverlay(onToolChange){let canvas=null,toolbar=null,tool=null,color=palette[0].value,textSize=24,displayId=null;
 const trusted=(event,window)=>Boolean(window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame);
 const send=(channel,value)=>{for(const window of [canvas,toolbar])if(window&&!window.isDestroyed())window.webContents.send(channel,value);};
 const state=()=>send('overlay:state',{tool,color,palette,textSize});
 const clear=()=>send('overlay:clear');
 const close=()=>{for(const window of [canvas,toolbar])if(window&&!window.isDestroyed())window.destroy();canvas=null;toolbar=null;tool=null;displayId=null;};
 function create(file,bounds){const window=new BrowserWindow({...bounds,frame:false,acceptFirstMouse:true,transparent:true,hasShadow:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,title:'Lessonara · Anotações',webPreferences:{preload:path.join(__dirname,'overlay-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  window.setAlwaysOnTop(true,'floating');window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(url!==pathToFileURL(path.join(__dirname,file)).href)event.preventDefault();});
  window.webContents.once('did-finish-load',()=>{window.webContents.send('overlay:tool',tool);window.webContents.send('overlay:color',color);window.webContents.send('overlay:text-size',textSize);state();});void window.loadFile(path.join(__dirname,file));return window;
 }
 function present(id){const display=screen.getAllDisplays().find(d=>String(d.id)===String(id));if(!display)return false;if(displayId!==id)close();displayId=id;
  if(!canvas){canvas=create('overlay.html',display.bounds);canvas.setIgnoreMouseEvents(true,{forward:true});canvas.on('closed',()=>{canvas=null;});}
  if(!toolbar){const area=display.workArea,width=Math.min(760,area.width);toolbar=create('annotation-toolbar.html',{x:area.x+Math.round((area.width-width)/2),y:area.y+12,width,height:150});if(process.platform==='win32')toolbar.setContentProtection(true);toolbar.on('closed',()=>{toolbar=null;});}
  toolbar.showInactive();return true;
 }
 function set(mode,id=displayId){if(!tools.has(mode))return;if(mode&&!present(id))return;tool=mode;canvas?.setIgnoreMouseEvents(!mode,{forward:true});send('overlay:tool',mode);state();if(mode){canvas?.show();canvas?.focus();toolbar?.moveTop();}}
 ipcMain.handle('overlay:settings',event=>trusted(event,toolbar)?{tool,color,palette,textSize}:null);
 ipcMain.on('overlay:stop',event=>{if(trusted(event,canvas)||trusted(event,toolbar)){set(null);onToolChange(null);}});
 ipcMain.on('overlay:select',(event,value)=>{if(trusted(event,toolbar)&&tools.has(value)){set(value);onToolChange(value);}});
 ipcMain.on('overlay:color',(event,value)=>{if(trusted(event,toolbar)&&palette.some(item=>item.value===value)){color=value;send('overlay:color',color);state();}});
 ipcMain.on('overlay:text-size',(event,value)=>{if(trusted(event,toolbar)&&Number.isInteger(value)&&value>=10&&value<=50){textSize=value;send('overlay:text-size',value);state();}});
 ipcMain.on('overlay:clear',event=>{if(trusted(event,toolbar))clear();});
 ipcMain.on('overlay:undo',event=>{if(trusted(event,toolbar))send('overlay:undo');});
 return {set,clear,close,present};
}
module.exports={setupOverlay};
