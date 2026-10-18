"use client";
import {FormActions} from "./button";
import {Toast} from "./toast";
import {Icon} from "@/components/icon";

import {useState,useTransition} from "react";
import {useI18n} from "./browser-preferences-provider";
import {type Locale,type Theme} from "@/lib/i18n/core";
import {BusyContent} from "./busy-content";
export function BrowserPreferences({compact=false}:{compact?:boolean}){
 const {locale,theme,t,save}=useI18n();const [language,setLanguage]=useState(locale);const [appearance,setAppearance]=useState(theme);const [pending,startTransition]=useTransition();const [message,setMessage]=useState("");
 return <section className={compact?"browser-preferences-compact":"card space-y-5"}><div><h2 className="h2">{t("Preferências deste navegador")}</h2><p className="text-sm text-muted">{t("Estas escolhas valem apenas neste navegador.")}</p></div><form onSubmit={event=>{event.preventDefault();if(pending)return;setMessage("");startTransition(async()=>{try{await save(language,appearance);setMessage("Preferências salvas.");}catch{setMessage("Não foi possível salvar suas preferências.");}});}} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor={`interface-language-${compact}`}>{t("Idioma")}</label><select id={`interface-language-${compact}`} className="input" value={language} onChange={event=>setLanguage(event.target.value as Locale)} disabled={pending}><option value="pt-BR">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></div><div><label className="label" htmlFor={`interface-theme-${compact}`}>{t("Aparência")}</label><select id={`interface-theme-${compact}`} className="input" value={appearance} onChange={event=>setAppearance(event.target.value as Theme)} disabled={pending}><option value="light">{t("Claro")}</option><option value="dark">{t("Escuro")}</option><option value="system">{t("Acompanhar o sistema")}</option></select></div></div><FormActions><button className="btn" disabled={pending} aria-busy={pending}><Icon name="save" className="h-4 w-4"/><BusyContent pending={pending} label={t("Salvando…")}>{t("Salvar preferências")}</BusyContent></button></FormActions>{message&&<Toast message={t(message)}/>}</form></section>;
}
