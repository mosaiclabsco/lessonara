export type DesktopState={compact:boolean;capture:"screen"|"window"|null;tool:"pen"|"laser"|"text"|"eraser"|"select"|null};
export type DesktopBridge={version:string;hubReady:()=>void;call:(state:{joined:boolean;teacher:boolean})=>void;restore:()=>void;compact:()=>void;tool:(tool:DesktopState["tool"])=>void;clear:()=>void;captureStopped:()=>void;onState:(callback:(state:DesktopState)=>void)=>()=>void};
declare global{interface Window{lessonaraDesktop?:DesktopBridge}}
