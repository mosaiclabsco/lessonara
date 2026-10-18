"use client";
import {useEffect, useRef, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import "@/lib/desktop-client";
import {signOut} from "@/app/login/actions";
import {formatDateLong, nowInTZ} from "@/lib/dates";
import {ActionForm, SubmitButton} from "./action-form";
import {Button} from "./button";
import {Icon} from "./icon";
import {LogoMark} from "./logo";

type Call = {id:string; date:string; time:string; name:string; href:string; startsAt:number; endsAt:number; closesAt:number};
export function CallsHome({name,enabled,today,now,lessons}:{name:string;enabled:boolean;today:string;now:number;lessons:Call[]}) {
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const [clock,setClock]=useState(now);
  const [chosenDate,setChosenDate]=useState<string|null>(null);
  const loadedDay=useRef(today);
  useEffect(()=>{loadedDay.current=today;},[today]);
  useEffect(()=>{
    window.lessonaraDesktop?.hubReady?.();
    const tick=()=>{
      const current=Date.now();
      setClock(current);
      const day=nowInTZ(new Date(current)).today;
      if(day!==loadedDay.current){
        loadedDay.current=day;
        startTransition(()=>router.refresh());
      }
    };
    const onVisible=()=>{if(document.visibilityState==='visible')tick();};
    const interval=window.setInterval(tick,30_000);
    window.addEventListener('focus',tick);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{window.clearInterval(interval);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',onVisible);};
  },[router]);
  const currentDay=nowInTZ(new Date(clock)).today;
  const selectedDate=chosenDate??currentDay;
  const dates=[...new Set([currentDay,...lessons.filter(l=>l.date>=currentDay).map(l=>l.date)])].sort();
  const daily=lessons.filter(l=>l.date===selectedDate);
  const upcoming=daily.filter(l=>l.endsAt>clock);
  const ended=daily.filter(l=>l.endsAt<=clock);
  const refresh=()=>{setClock(Date.now());startTransition(()=>router.refresh());};
  const renderCall=(lesson:Call)=>{
    const finished=lesson.endsAt<=clock;
    const live=lesson.startsAt<=clock&&!finished;
    const initials=lesson.name.split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('');
    return <li className={`card call-row ${live?'call-row-live':''}`} key={lesson.id}>
      <div className="call-time"><strong>{lesson.time}</strong><span>{Math.round((lesson.endsAt-lesson.startsAt)/60_000)} min</span></div>
      <span className="call-avatar" aria-hidden="true">{initials}</span>
      <div className="call-person"><h3>{lesson.name}</h3><span className={`call-status ${live?'call-status-live':''}`}><Icon name={finished?'check':live?'video':'clock'} className="h-3 w-3"/>{finished?'Encerrada':live?'Em andamento':'Agendada'}</span></div>
      {lesson.closesAt>clock?<a className={finished?'btn-ghost':'btn'} href={lesson.href}><Icon name="video" className="h-4 w-4"/>{finished?'Voltar à chamada':'Entrar na chamada'}</a>:<span className="text-muted text-sm">Horário encerrado</span>}
    </li>;
  };
  return <main className="calls-home">
    <header><div className="flex items-center gap-3"><LogoMark className="h-9 w-9 text-accent"/><div><strong>Lessonara · Chamadas</strong><p>{name}</p></div></div><div className="flex gap-3"><a className="btn-ghost" href="/" target="_blank" rel="noreferrer"><Icon name="arrow" className="h-4 w-4"/>Portal web</a><ActionForm action={signOut}><SubmitButton className="btn-ghost" icon="logout">Sair</SubmitButton></ActionForm></div></header>
    <section className="calls-heading"><div><h1>Suas chamadas</h1><p>Escolha a aula quando estiver pronto para entrar.</p></div><Button icon="refresh" pending={pending} onClick={refresh}>Atualizar</Button></section>
    {!enabled?<section className="card"><h2>Sala de aula no plano Pro</h2><p>Gerencie seu plano pelo portal web.</p><a className="btn mt-4" href="/settings?tab=subscription#subscription" target="_blank" rel="noreferrer"><Icon name="settings" className="h-4 w-4"/>Abrir configurações</a></section>:<>
      <section className="calls-daybar"><div><Icon name="calendar" className="h-5 w-5"/><div><h2>{selectedDate===currentDay?'Hoje':formatDateLong(selectedDate)}</h2><p>{selectedDate===currentDay?formatDateLong(selectedDate):'Agenda do dia'} · {daily.length} {daily.length===1?'aula':'aulas'}</p></div></div><div><label className="label" htmlFor="calls-date">Ver outro dia</label><select className="input" id="calls-date" value={chosenDate??''} onChange={e=>setChosenDate(e.target.value||null)}><option value="">Hoje</option>{dates.filter(d=>d!==currentDay).map(d=><option key={d} value={d}>{formatDateLong(d)}</option>)}{chosenDate&&!dates.includes(chosenDate)&&<option value={chosenDate}>{formatDateLong(chosenDate)}</option>}</select></div></section>
      <section className="calls-section" aria-labelledby="upcoming-calls"><h2 id="upcoming-calls">{selectedDate===currentDay?'Próximas de hoje':'Chamadas do dia'}<span>{upcoming.length}</span></h2>{upcoming.length?<ul className="calls-list">{upcoming.map(renderCall)}</ul>:<div className="card calls-empty"><Icon name="calendar" className="h-8 w-8 text-accent"/><h3>{ended.length?'Tudo certo por hoje':'Nenhuma chamada agendada'}</h3><p>{ended.length?'As aulas deste dia já terminaram.':'Confira outro dia ou ajuste sua agenda pelo portal web.'}</p></div>}</section>
      {!!ended.length&&<details className="calls-ended"><summary>Encerradas neste dia <span>{ended.length}</span></summary><ul className="calls-list">{ended.map(renderCall)}</ul></details>}
      <p className="calls-footnote"><Icon name="pointer" className="h-4 w-4"/>Você escolhe quando entrar e trocar de sala.</p>
    </>}
  </main>;
}
