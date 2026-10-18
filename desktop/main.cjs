const {app,BrowserWindow,Menu,dialog,session,nativeImage,ipcMain,shell,screen}=require('electron');
const path=require('node:path');
const {APP_ORIGIN,deepLinkToUrl,isCallUrl,isAppUrl,isMediaOrigin,validRoomPath}=require('./links.cjs');
const {setupCapture}=require('./capture.cjs');const {setupOverlay}=require('./overlay.cjs');
let hubReady=false;
let mainWindow=null,pendingRoom=null,joined=false,teacher=false,compact=false,savedBounds=null,switching=false,capture=null,displayId=null,tool=null,cancelCapture=null,overlay=null;
app.setName('Lessonara');const locked=app.requestSingleInstanceLock();if(!locked)app.quit();
function trusted(event){return Boolean(mainWindow&&event.sender===mainWindow.webContents&&event.senderFrame===mainWindow.webContents.mainFrame&&isCallUrl(event.senderFrame.url));}
function state(){if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('desktop:state',{compact,capture,tool});}
function stopCapture(){capture=null;displayId=null;tool=null;overlay?.close();state();}
function setCompact(value){if(!mainWindow||switching||value===compact||(value&&!joined))return;switching=true;compact=value;
 if(value){savedBounds=mainWindow.getBounds();const area=screen.getDisplayMatching(savedBounds).workArea;mainWindow.setMinimumSize(360,280);if(mainWindow.isMinimized())mainWindow.restore();if(mainWindow.isFullScreen())mainWindow.setFullScreen(false);mainWindow.setBounds({x:area.x+area.width-450,y:area.y+area.height-390,width:430,height:360});mainWindow.setAlwaysOnTop(true,'pop-up-menu');mainWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});mainWindow.show();}
 else {mainWindow.setAlwaysOnTop(false);mainWindow.setVisibleOnAllWorkspaces(false);mainWindow.setMinimumSize(850,600);if(savedBounds)mainWindow.setBounds(savedBounds);mainWindow.show();mainWindow.focus();}
 switching=false;state();}
function focus(){if(!mainWindow)return;setCompact(false);if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}
async function canLeave(message='Trocar de aula?'){if(!joined)return true;const choice=await dialog.showMessageBox(mainWindow,{type:'question',message,detail:'Você sairá da chamada atual. A troca só acontece quando você confirmar.',buttons:['Continuar na aula','Sair da aula'],defaultId:0,cancelId:0});return choice.response===1;}
async function navigate(url){if(!mainWindow||!isCallUrl(url))return;if(mainWindow.webContents.getURL()===url){focus();return;}if(!await canLeave())return;cancelCapture?.();joined=false;teacher=false;stopCapture();setCompact(false);void mainWindow.loadURL(url);}
async function openLesson(value){const target=deepLinkToUrl(value);if(!target)return;pendingRoom=target;if(!mainWindow){if(app.isReady())createWindow();return;}focus();const current=mainWindow.webContents.getURL();if(current===target){pendingRoom=null;return;}if(current===APP_ORIGIN+'/calls'&&hubReady){pendingRoom=null;await navigate(target);}else if(current.startsWith(APP_ORIGIN+'/classroom/')){pendingRoom=null;await navigate(target);} }
app.on('open-url',(event,url)=>{event.preventDefault();void openLesson(url);});app.on('second-instance',(_event,args)=>{focus();const link=args.find(value=>value.startsWith('lessonara://'));if(link)void openLesson(link);});
function routeOutside(url){if(isAppUrl(url))void shell.openExternal(url);}
function createWindow(){
 mainWindow=new BrowserWindow({width:1100,height:800,minWidth:850,minHeight:600,title:'Lessonara · Chamadas',backgroundColor:'#f5f7f6',webPreferences:{preload:path.join(__dirname,'preload.cjs'),partition:'persist:lessonara',contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 mainWindow.webContents.setWindowOpenHandler(({url})=>{if(isCallUrl(url))void navigate(url);else routeOutside(url);return {action:'deny'};});
 mainWindow.webContents.on('will-navigate',(event,url)=>{event.preventDefault();if(isCallUrl(url))void navigate(url);else routeOutside(url);});
 mainWindow.webContents.on('will-redirect',(event,url,_inPlace,isMainFrame)=>{if(isMainFrame&&!isCallUrl(url)){event.preventDefault();if(isAppUrl(url))void mainWindow.loadURL(APP_ORIGIN+'/calls');}});
 mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
 const route=(_event,url)=>{if(!isCallUrl(url)){joined=false;stopCapture();void mainWindow.loadURL(APP_ORIGIN+'/calls');return;}if(url===APP_ORIGIN+'/calls')hubReady=false;state();};
 mainWindow.webContents.on('did-navigate',route);mainWindow.webContents.on('did-navigate-in-page',route);
 mainWindow.webContents.on('render-process-gone',()=>{joined=false;stopCapture();void dialog.showMessageBox(mainWindow,{type:'error',message:'A janela da chamada foi interrompida.',detail:'Abra a chamada novamente ou use o navegador.',buttons:['OK']});});
 mainWindow.on('minimize',()=>{if(joined&&!switching){if(compact)mainWindow.restore();else setCompact(true);}});
 mainWindow.on('close',event=>{if(joined){event.preventDefault();void canLeave('Encerrar a chamada?').then(leave=>{if(leave){joined=false;mainWindow.close();}});}});
 mainWindow.on('closed',()=>{cancelCapture?.();stopCapture();mainWindow=null;compact=false;joined=false;});void mainWindow.loadURL(APP_ORIGIN+'/calls');
}
if(locked)app.whenReady().then(()=>{
 if(app.isPackaged)app.setAsDefaultProtocolClient('lessonara');
 overlay=setupOverlay(value=>{tool=value;state();});
 ipcMain.on('desktop:hub-ready',event=>{if(!trusted(event)||event.senderFrame.url!==APP_ORIGIN+'/calls')return;hubReady=true;if(pendingRoom){const room=pendingRoom;pendingRoom=null;void navigate(room);}});
 ipcMain.handle('desktop:state:get',event=>trusted(event)?{compact,capture,tool}:null);
 ipcMain.on('desktop:call',(event,value)=>{if(!trusted(event)||typeof value?.joined!=='boolean'||typeof value?.teacher!=='boolean')return;const room=validRoomPath(new URL(event.senderFrame.url).pathname);joined=room&&value.joined;teacher=room&&value.teacher;if(!joined){stopCapture();setCompact(false);}state();});
 ipcMain.on('desktop:restore',event=>{if(trusted(event))focus();});ipcMain.on('desktop:compact',event=>{if(trusted(event))setCompact(true);});
 ipcMain.on('desktop:tool',(event,value)=>{if(!trusted(event)||!joined||!teacher||capture!=='screen'||![null,'pen','laser','text','eraser','select'].includes(value))return;tool=value;overlay.set(value,displayId);state();});
 ipcMain.on('desktop:clear',event=>{if(trusted(event)&&teacher)overlay.clear();});
 ipcMain.on('desktop:capture-stopped',event=>{if(trusted(event))stopCapture();});
 const ses=session.fromPartition('persist:lessonara');
 ses.setPermissionCheckHandler((_contents,permission,origin)=>isMediaOrigin(origin)&&['media','display-capture','fullscreen'].includes(permission));
 const allowed=new Set();ses.setPermissionRequestHandler(async(_contents,permission,callback,details)=>{const origin=details.requestingUrl||details.embeddingOrigin||'';if(!isMediaOrigin(origin)||!['media','display-capture','fullscreen'].includes(permission)){callback(false);return;}if(permission==='fullscreen'||permission==='display-capture'||allowed.has(permission)){callback(true);return;}const answer=await dialog.showMessageBox(mainWindow,{type:'question',title:'Permissão para aula',message:'Permitir câmera e microfone para a aula?',detail:'Você controla os dispositivos na sala. O macOS também pode solicitar sua autorização.',buttons:['Agora não','Permitir'],defaultId:0,cancelId:0});if(answer.response===1)allowed.add(permission);callback(answer.response===1);});
 cancelCapture=setupCapture(ses,()=>mainWindow,source=>{overlay.close();tool=null;capture=source.id.startsWith('screen:')?'screen':'window';displayId=source.display_id||null;if(teacher&&capture==='screen')overlay.present(displayId);state();});
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Lessonara',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'Editar',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'Chamada',submenu:[{label:'Voltar à sala',click:focus},{label:'Janela flutuante',click:()=>setCompact(true)},{label:'Desativar ferramenta',click:()=>{tool=null;overlay.set(null);state();}},{role:'minimize'},{role:'togglefullscreen'}]}]));
 app.dock?.setIcon(nativeImage.createFromPath(path.join(__dirname,'icon.png')));createWindow();const initial=process.argv.find(value=>value.startsWith('lessonara://'));if(initial)void openLesson(initial);
});
app.on('activate',()=>{if(!locked)return;if(!mainWindow)createWindow();else focus();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});app.on('will-quit',()=>{cancelCapture?.();overlay?.close();});
