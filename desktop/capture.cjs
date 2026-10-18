const {BrowserWindow,desktopCapturer,ipcMain,dialog,systemPreferences}=require('electron');
const path=require('node:path');
const {isMediaOrigin,validRoomPath,APP_ORIGIN}=require('./links.cjs');
function captureAllowed(request,contents){try{return Boolean(request.userGesture&&request.videoRequested&&request.frame&&!request.frame.isDestroyed()&&request.frame.top===contents.mainFrame&&isMediaOrigin(request.securityOrigin)&&new URL(contents.getURL()).origin===APP_ORIGIN&&validRoomPath(new URL(contents.getURL()).pathname));}catch{return false;}}
function setupCapture(session,getWindow,onSelected){let active=null;
 const explain=(parent,reason)=>{if(parent.isDestroyed())return;void dialog.showMessageBox(parent,{type:'info',title:'Compartilhamento de tela',message:reason,detail:process.platform==='darwin'?'Confira Lessonara em Ajustes do Sistema → Privacidade e Segurança → Gravação do Áudio do Sistema e da Tela. Se já estiver ativado após atualizar o app, feche o Lessonara com ⌘Q, remova somente sua entrada e adicione novamente /Applications/Lessonara.app. Abra o app e tente compartilhar outra vez. A assinatura de teste muda entre versões.':'Tente compartilhar novamente. Se continuar sem abrir, feche e reabra o Lessonara e verifique se outro seletor já está aberto.',buttons:['Entendi']}).catch(()=>{});};
 const finish=source=>{const current=active;if(!current)return;active=null;clearTimeout(current.timer);if(current.window&&!current.window.isDestroyed())current.window.destroy();const permitted=source&&captureAllowed(current.request,getWindow()?.webContents);try{current.callback(permitted?{video:source}:null);}catch{}if(permitted)onSelected(source);};
 ipcMain.handle('capture:list',event=>active?.window&&event.sender===active.window.webContents?active.sources.map(s=>({id:s.id,name:s.name,type:s.id.startsWith('screen:')?'screen':'window',thumbnail:s.thumbnail.toDataURL()})):[]);
 ipcMain.on('capture:choose',(event,id)=>{if(!active?.window||event.sender!==active.window.webContents)return;finish(active.sources.find(s=>s.id===id)||null);});
 ipcMain.on('capture:cancel',event=>{if(active?.window&&event.sender===active.window.webContents)finish(null);});
 session.setDisplayMediaRequestHandler(async(request,callback)=>{
  const parent=getWindow();if(active||!parent||!captureAllowed(request,parent.webContents)){callback(null);return;}
  if(process.platform==='darwin'&&['denied','restricted'].includes(systemPreferences.getMediaAccessStatus('screen'))){callback(null);explain(parent,'O macOS não autorizou a versão atual do Lessonara a compartilhar a tela.');return;}
  // Reserve the request before enumeration: macOS can leave getSources pending during permission recovery.
  const current={window:null,sources:[],request,callback,timer:null};active=current;
  current.timer=setTimeout(()=>{if(active!==current)return;finish(null);explain(parent,'O macOS não respondeu ao pedido de telas e janelas.');},20000);
  try{const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:320,height:180},fetchWindowIcons:false});if(active!==current)return;if(!captureAllowed(request,parent.webContents)){finish(null);return;}if(!sources.length){finish(null);explain(parent,'Nenhuma tela ou janela disponível para compartilhar.');return;}
   clearTimeout(current.timer);const picker=new BrowserWindow({width:900,height:640,minWidth:600,minHeight:440,parent,modal:true,title:'Compartilhar tela · Lessonara',webPreferences:{preload:path.join(__dirname,'capture-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
   Object.assign(current,{window:picker,sources,timer:setTimeout(()=>finish(null),180000)});
   picker.webContents.setWindowOpenHandler(()=>({action:'deny'}));picker.webContents.on('will-navigate',e=>e.preventDefault());picker.on('closed',()=>{if(active===current)finish(null);});await picker.loadFile(path.join(__dirname,'capture.html'));
  }catch{if(active===current){finish(null);explain(parent,'Não foi possível abrir o seletor de telas e janelas.');}}
 },{useSystemPicker:false});
 return()=>finish(null);
}
module.exports={captureAllowed,setupCapture};
