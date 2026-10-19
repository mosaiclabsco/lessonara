"use client";
import {useEffect, useState} from "react";

/** Atualiza nos limites de acesso, inclusive ao retomar uma aba suspensa. */
export function useLessonClock(initialNow:number, boundaries:number[]) {
  const [now,setNow]=useState(initialNow);
  const nextBoundary=boundaries.reduce((next,value)=>value>now?Math.min(next,value):next,Infinity);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const visible=()=>{if(document.visibilityState==="visible")tick();};
    const timer=window.setTimeout(tick,Math.min(60_000,Math.max(0,nextBoundary-Date.now())));
    window.addEventListener("focus",tick);
    document.addEventListener("visibilitychange",visible);
    return ()=>{window.clearTimeout(timer);window.removeEventListener("focus",tick);document.removeEventListener("visibilitychange",visible);};
  },[now,nextBoundary]);
  return now;
}
