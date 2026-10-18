"use client";
import {type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {Button} from "./button";
import {Icon} from "./icon";
import {useI18n} from "./browser-preferences-provider";
export function IntegrationCatalog({children,connected,open=false}:{children:ReactNode;connected:boolean;open?:boolean}) {const router=useRouter();const {t}=useI18n();return open?<div className="space-y-5"><Button icon="back" onClick={()=>router.push("/settings?tab=integrations#integrations",{scroll:false})}>{t("Voltar às integrações")}</Button>{children}</div>:<section className="card"><h2 className="h2">{t("Integrações")}</h2><p className="page-description">{t("Conecte os serviços que usa nas suas aulas.")}</p><div className="integration-grid"><button type="button" className="integration-card" onClick={()=>router.push("/settings?tab=integrations&integration=google#integrations",{scroll:false})}><span className="integration-icon"><Icon name="calendar" className="h-7 w-7"/></span><strong>Google Calendar e Meet</strong><span className={`balance-pill ${connected?"":"balance-warning"}`}>{t(connected?"Conectado":"Não conectado")}</span><span className="integration-card-link">{t("Configurar integração")}<Icon name="arrow" className="h-4 w-4"/></span></button></div></section>;}
