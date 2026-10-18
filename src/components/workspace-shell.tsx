"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import Link from "next/link";
import {LogoMark} from "./logo";
import {Icon} from "./icon";
import {Button} from "./button";
import {ActionForm,SubmitButton} from "./action-form";
import {signOut} from "@/app/login/actions";
import {useI18n} from "./browser-preferences-provider";
const collapseKey="lessonara:menu-collapsed";
const subscribeMenu=(callback:()=>void)=>{window.addEventListener("lessonara:menu",callback);window.addEventListener("storage",callback);window.addEventListener("resize",callback);return()=>{window.removeEventListener("lessonara:menu",callback);window.removeEventListener("storage",callback);window.removeEventListener("resize",callback);};};
const readMenu=()=>{try{const stored=localStorage.getItem(collapseKey);return stored===null?window.matchMedia("(max-width: 767px)").matches:stored==="true";}catch{return false;}};
export function WorkspaceShell({name,nav,children}:{name:string;nav:ReactNode;children:ReactNode}) {
 const {t}=useI18n();const collapsed=useSyncExternalStore(subscribeMenu,readMenu,()=>false);const [menu,setMenu]=useState(false);const profile=useRef<HTMLDivElement>(null);

 useEffect(()=>{function close(e:PointerEvent){if(!profile.current?.contains(e.target as Node))setMenu(false);}function escape(e:KeyboardEvent){if(e.key==="Escape")setMenu(false);}document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};},[]);
 const initials=name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase()||"P";
 function toggle(){try{localStorage.setItem(collapseKey,String(!collapsed));}catch{}window.dispatchEvent(new Event("lessonara:menu"));}
 return <div className={`app-shell ${collapsed?"menu-collapsed":""}`}><a href="#content" className="skip-link">{t("Pular para o conteúdo")}</a><aside id="workspace-menu" className="sidebar" aria-label={t("Menu principal")}><div className="sidebar-head"><Link href="/" className="brand" aria-label="Lessonara" aria-hidden={collapsed} tabIndex={collapsed?-1:undefined}><LogoMark className="h-8 w-8 text-accent"/><span className="brand-word">lessonara<span className="brand-dot">.</span></span></Link><Button icon="menu" variant="menu" className="icon-button sidebar-toggle" aria-label={t(collapsed?"Expandir menu":"Recolher menu")} aria-controls="workspace-menu" aria-expanded={!collapsed} onClick={toggle}/></div>{nav}</aside><div className="workspace"><header className="workspace-header"><Button icon="menu" variant="menu" className="icon-button mobile-menu-toggle" aria-label={t(collapsed?"Expandir menu":"Recolher menu")} aria-controls="workspace-menu" aria-expanded={!collapsed} onClick={toggle}/><div ref={profile} className="profile-menu"><button type="button" className="profile-trigger" aria-label={`${t("Sua conta")}: ${name}`} aria-expanded={menu} aria-controls="profile-options" onClick={()=>setMenu(!menu)}><span className="profile-initials">{initials}</span><span className="profile-name">{name}</span><Icon name="chevron" className="h-4 w-4"/></button>{menu&&<div id="profile-options" className="profile-options"><ActionForm action={signOut}><SubmitButton className="menu-action" pendingLabel="" icon="logout">{t("Sair")}</SubmitButton></ActionForm></div>}</div></header><div id="content" className="workspace-content">{children}</div><footer className="workspace-footer"><span>lessonara.</span></footer></div></div>;
}
