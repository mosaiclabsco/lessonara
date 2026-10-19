"use server";

import { redirect } from "next/navigation";
import {headers} from "next/headers";
import {allowTeacherLogin} from "@/lib/login-limit";
import {createAdminClient} from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string; email: string } | null;

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email=String(formData.get("email")??"").trim().toLowerCase();
  const password=String(formData.get("password")??"");
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length>4096)return {error:"Email ou senha inválidos.",email};
  try {
    const ip=process.env.VERCEL?(await headers()).get("x-vercel-forwarded-for")?.split(",")[0]?.trim()||"unknown":"local";
    if(!await allowTeacherLogin(createAdminClient(),email,ip))return {error:"Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",email};
  } catch {return {error:"Não foi possível entrar agora. Tente novamente mais tarde.",email};}
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email ou senha inválidos.", email };
  redirect(formData.get("destination")==="calls"?"/calls":"/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
