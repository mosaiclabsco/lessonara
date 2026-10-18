"use client";
import {useI18n} from "@/components/browser-preferences-provider";
import {Icon} from "./icon";
import {BusyContent} from "./busy-content";
import {useRef,useState} from "react";
export function CopyButton({text,label="Copiar link"}:{text:string;label?:string}){
 const {t}=useI18n();const [copied,setCopied]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState(false);const running=useRef(false);
 return <><button type="button" className="btn-xs copy-button" disabled={pending} aria-busy={pending} onClick={async()=>{if(running.current)return;running.current=true;setPending(true);setError(false);try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setError(true);}finally{running.current=false;setPending(false);}}}><BusyContent pending={pending}><Icon name={copied?"check":"copy"} className="h-4 w-4"/><span className="stable-button-label"><span aria-hidden={copied} style={{visibility:copied?"hidden":"visible"}}>{t(label)}</span><span aria-hidden={!copied} style={{visibility:copied?"visible":"hidden"}}>{t("Copiado!")}</span></span></BusyContent></button>{error&&<span role="status" className="text-xs text-muted">{t("Copie o link manualmente:")} {text}</span>}</>;
}
