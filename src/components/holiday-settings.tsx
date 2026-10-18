"use client";
import {ConfirmDialog} from "./dialog";
import {FormActions} from "./button";
import {Toast} from "./toast";
import {Icon} from "@/components/icon";

import {HolidaySuggestions} from "./holiday-suggestions";
import {BusyContent} from "@/components/busy-content";
import { useI18n } from "@/components/browser-preferences-provider";
import { useState, useTransition } from "react";
import { addDays, formatDate } from "@/lib/dates";
import type { HolidaySettings, HolidayRow } from "@/lib/holiday-data";
import { addHoliday, removeHoliday, saveHolidayRule } from "@/app/(panel)/settings/holiday-actions";
export function HolidaySettingsForm({ settings, holidays, today, locked, ready }: {
    settings: HolidaySettings | null;
    holidays: HolidayRow[];
    today: string;
    locked: boolean;
    ready: boolean;
}) {
    const { t, locale } = useI18n();

    const [policy, setPolicy] = useState(settings?.policy ?? "preserve");
    const [message, setMessage] = useState("");
    const [pending, startTransition] = useTransition();
    const [busyAction,setBusyAction]=useState("");const [suggestionsBusy,setSuggestionsBusy]=useState(false);const blocked=pending||suggestionsBusy;
    const [removing, setRemoving] = useState<string | null>(null);
    return <section className="card space-y-5" data-action-busy={blocked}><div><h2 className="h2">{t("Feriados da empresa")}</h2><p className="text-xs leading-relaxed text-muted">{t("Uma regra para todos os seus alunos. Voc\u00EA cadastra as datas, incluindo feriados locais.")}</p></div>
 {!ready ? <p role="status" className="text-sm text-muted">{t("A configura\u00E7\u00E3o de feriados ainda est\u00E1 em prepara\u00E7\u00E3o.")}</p> : <>
 <form onSubmit={event => {
                event.preventDefault();
                setMessage("");setBusyAction("rule");
                startTransition(async () => {
                    try {
                        const result = await saveHolidayRule(true, policy);
                        setMessage(result.ok ? "Regra de feriados salva." : result.message);
                    }
                    catch {
                        setMessage("Não foi possível salvar a regra.");
                    }
                });
            }} className="space-y-4">
 <fieldset disabled={locked || blocked} className="space-y-4 disabled:opacity-70">
 <div className="space-y-3"><label className="flex items-start gap-3 rounded-xl border border-line p-4"><input type="radio" name="holiday-policy" value="consume" checked={policy === "consume"} onChange={() => setPolicy("consume")}  className="mt-1"/><span><b className="text-sm font-medium">{t("Feriado consome uma aula")}</b><span className="mt-1 block text-xs text-muted">{t("A aula n\u00E3o acontece, mas desconta um cr\u00E9dito do pacote.")}</span></span></label>
 <label className="flex items-start gap-3 rounded-xl border border-line p-4"><input type="radio" name="holiday-policy" value="preserve" checked={policy === "preserve"} onChange={() => setPolicy("preserve")}  className="mt-1"/><span><b className="text-sm font-medium">{t("Feriado mant\u00E9m o cr\u00E9dito")}</b><span className="mt-1 block text-xs text-muted">{t("Sem desconto. O pacote passa a cobrir o pr\u00F3ximo encontro; n\u00E3o cria cr\u00E9ditos extras.")}</span></span></label></div>
 <FormActions><button className="btn" type="submit" aria-busy={pending&&busyAction==="rule"}><Icon name="save" className="h-4 w-4"/><BusyContent pending={pending&&busyAction==="rule"}>{t("Salvar regra de feriados")}</BusyContent></button></FormActions></fieldset>
 <p className="text-xs leading-relaxed text-muted">{locked ? t("Regra travada: a primeira aula em feriado j\u00E1 foi afetada. Isso protege os saldos e o hist\u00F3rico.") : t("A regra pode mudar at\u00E9 a primeira aula afetada. Depois disso, a forma de contagem fica travada.")} {settings?.effective_from && t("V\u00E1lida a partir de {value0}.", { value0: formatDate(settings.effective_from, locale) })}</p></form>
 <HolidaySuggestions disabled={pending} onBusyChange={setSuggestionsBusy} today={today} existing={holidays.map(h=>h.date)}/><div className="border-t border-line pt-5"><h3 className="mb-3 text-sm font-semibold">{t("Datas cadastradas")}</h3><p className="mb-4 text-xs leading-relaxed text-muted">{t("Cadastre a partir de amanh\u00E3 para preservar aulas j\u00E1 registradas. Feriados de hoje ou anteriores n\u00E3o podem ser alterados. Reposi\u00E7\u00F5es lan\u00E7adas manualmente continuam consumindo cr\u00E9dito.")}</p>
 <form onSubmit={event => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                setMessage("");setBusyAction("add");
                startTransition(async () => {
                    try {
                        const result = await addHoliday(String(data.get("date")), String(data.get("name")));
                        setMessage(result.ok ? "Feriado cadastrado." : result.message);
                        if (result.ok)
                            form.reset();
                    }
                    catch {
                        setMessage("Não foi possível cadastrar o feriado.");
                    }
                });
            }} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
 <div><label className="label" htmlFor="holiday-date">{t("Data")}</label><input className="input" id="holiday-date" name="date" type="date" min={addDays(today, 1)} required disabled={blocked}/></div><div><label className="label" htmlFor="holiday-name">{t("Nome do feriado")}</label><input className="input" id="holiday-name" name="name" maxLength={120} required placeholder={t("Ex.: Feriado municipal")} disabled={blocked}/></div><button className="btn self-end" aria-busy={pending&&busyAction==="add"} disabled={blocked}><Icon name="plus" className="h-4 w-4"/><BusyContent pending={pending&&busyAction==="add"}>{t("Adicionar feriado")}</BusyContent></button></form>
 {!settings?.enabled && <p className="mt-3 text-xs text-muted">{t("Salve a regra para aplicar as datas cadastradas aos pacotes.")}</p>}
 <ul className="mt-5 divide-y divide-line">{holidays.map(holiday => <li key={holiday.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><span className="text-muted">{formatDate(holiday.date, locale)}</span><span className="flex-1">{holiday.name}</span>{holiday.date > today ? <><button className="btn-xs btn-danger" aria-busy={pending&&busyAction===holiday.id} disabled={blocked} onClick={() => setRemoving(holiday.id)}><Icon name="trash" className="h-4 w-4"/><BusyContent pending={pending&&busyAction===holiday.id}>{t("Remover")}</BusyContent></button></> : <span className="text-xs text-muted">{t("Hist\u00F3rico preservado")}</span>}</li>)}</ul>{!holidays.length && <p className="mt-4 text-xs text-muted">{t("Nenhum feriado cadastrado ainda.")}</p>}</div></>}<ConfirmDialog open={Boolean(removing)} onClose={()=>setRemoving(null)} title="Remover feriado" message="Remover este feriado das datas cadastradas?" confirmLabel="Remover feriado" danger pending={pending} onConfirm={()=>{if(!removing)return;setBusyAction(removing);setMessage("");startTransition(async()=>{try{const result=await removeHoliday(removing);setMessage(result.ok?"Feriado removido.":result.message);if(result.ok)setRemoving(null);}catch{setMessage("Não foi possível remover o feriado.");}});}}/>{message && <Toast message={t(message)}/>}</section>;
}
