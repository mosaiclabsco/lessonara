import { studentPortalPath } from "../student-links";
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export function studentLoginUrl(teacherId?: string, slug?: string) {
  const origin =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3001");
  return new URL(teacherId && slug ? studentPortalPath(slug) : "/student", origin).href;
}

function layout(title: string, content: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light only;supported-color-schemes:light}body{color-scheme:light only}@media(prefers-color-scheme:dark){.email-page{background-color:#eaf2ed!important;color:#283d39!important}.email-card{background-color:#fff!important;color:#283d39!important}}[data-ogsc] .email-page{background-color:#eaf2ed!important;color:#283d39!important}[data-ogsc] .email-card{background-color:#fff!important;color:#283d39!important}</style></head><body class="email-page" bgcolor="#eaf2ed" style="color-scheme:light only;margin:0;padding:32px 16px;background:#eaf2ed;font-family:Arial,sans-serif;color:#283d39"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-spacing:0"><tr><td style="padding:26px 32px;background:#f7f8fa;border-radius:16px 16px 0 0"><img src="${escapeHtml(new URL("/brand/complete-logo.png", studentLoginUrl()).href)}" width="162" height="36" alt="Lessonara" style="display:block;border:0;width:162px;height:36px"></td></tr><tr><td class="email-card" bgcolor="#ffffff" style="padding:32px;background:#fff;border-radius:0 0 16px 16px;font-size:14px;line-height:1.75"><h1 style="font-size:23px;line-height:1.35;margin:0 0 28px;color:#283d39">${escapeHtml(title)}</h1>${content}<hr style="border:0;border-top:1px solid #e7ece9;margin:32px 0 20px"><p style="margin:0;font-size:12px;color:#74827f">Lessonara · Suas aulas em um só lugar.</p></td></tr></table></body></html>`;
}
const button = (teacherId?: string, slug?: string, inviteUrl?: string) =>
  `<p style="margin:28px 0"><a href="${escapeHtml(inviteUrl ?? studentLoginUrl(teacherId, slug))}" style="background:#3e7163;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none">Entrar na área do aluno</a></p>`;

export function welcomeEmail(
  name: string,
  teacher: string,
  teacherId?: string,
  slug?: string,
  inviteUrl?: string,
) {
  const subject = "Boas-vindas ao Lessonara!";
  return {
    subject,
    html: layout(
      subject,
      `<p>Oi, ${escapeHtml(name)}!</p><p>${escapeHtml(teacher || "Seu professor(a)")} preparou seu espaço de aprendizagem.</p><p>Acompanhe suas aulas, pacotes, materiais e atividades em um só lugar.</p>${button(teacherId, slug, inviteUrl)}<p>Seu convite de primeiro acesso vale por 24 horas e é de uso único. Ao ativá-lo, sua sessão dura até 30 dias neste navegador.</p><p>Se o convite expirar, ou quando precisar entrar novamente, <a href="${escapeHtml(studentLoginUrl(teacherId, slug))}">solicite um código de acesso</a>.</p>`,
    ),
    text: `Oi, ${name}! ${teacher || "Seu professor(a)"} preparou seu espaço no Lessonara. Acompanhe aulas, materiais e atividades em ${studentLoginUrl(teacherId, slug)}. Seu convite de primeiro acesso: ${inviteUrl ?? studentLoginUrl(teacherId, slug)}. Válido por 24 horas, uso único. Após ativar, sua sessão dura até 30 dias. Depois disso, use um código de acesso.`,
  };
}

export function otpEmail(code: string) {
  return {
    subject: "Seu código de acesso ao Lessonara",
    html: layout(
      "Seu código de acesso",
      `<p>Use este código na página em que você solicitou o acesso:</p><p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#3e7163">${escapeHtml(code)}</p><p>Ele vale por 10 minutos e pode ser usado uma vez. Não compartilhe este código.</p><p>Se você não solicitou o acesso, ignore este email.</p>`,
    ),
    text: `Seu código de acesso ao Lessonara: ${code}. Válido por 10 minutos, uso único. Não compartilhe. Se não solicitou, ignore.`,
  };
}

export function reminderEmail(
  name: string,
  teacher: string,
  message: string,
  teacherId?: string,
  slug?: string,
) {
  return {
    subject: "Seu pacote de aulas está acabando",
    html: layout(
      "Vamos renovar seu pacote de aulas?",
      `<p>Oi, ${escapeHtml(name)}!</p><div style="background:#eef4ef;padding:18px;border-radius:12px;margin:20px 0"><p style="margin:0;font-weight:bold">${escapeHtml(message)}</p></div><p>Para continuar suas aulas, combine a renovação com ${escapeHtml(teacher || "seu professor(a)")}.</p><p>Confira seu histórico e próximos encontros no seu espaço de aprendizagem.</p>${button(teacherId, slug)}`,
    ),
    text: `Oi, ${name}! ${message} Fale com ${teacher || "seu professor(a)"} para renovar. Acompanhe suas aulas em ${studentLoginUrl(teacherId, slug)}.`,
  };
}

export function campaignEmail(
  name: string,
  teacher: string,
  subject: string,
  message: string,
  unsubscribeUrl: string,
) {
  return {
    subject,
    html: layout(
      subject,
      `<p>Oi, ${escapeHtml(name)}!</p><div style="white-space:pre-wrap;line-height:1.8;margin:24px 0;padding:20px;background:#f1f6f2;border-radius:10px">${escapeHtml(message)}</div><p>${escapeHtml(teacher)}</p><p style="font-size:12px;margin-top:28px"><a style="color:#3e7163" href="${escapeHtml(unsubscribeUrl)}">Não receber comunicações promocionais deste professor</a></p>`,
    ),
    text: `Oi, ${name}!\n\n${message}\n\n${teacher}\n\nCancelar comunicações promocionais: ${unsubscribeUrl}`,
  };
}

export function lessonNoticeEmail(
  name: string,
  teacher: string,
  date: string,
  time: string,
  teacherId: string,
  slug: string,
) {
  const subject = `Sua aula começa às ${time}`;
  const message = `Você tem uma aula com ${teacher || "seu professor(a)"} em ${date.split("-").reverse().join("/")} às ${time}.`;
  return {
    subject,
    html: layout(
      subject,
      `<p>Oi, ${escapeHtml(name)}!</p><p>${escapeHtml(message)}</p>${button(teacherId, slug)}<p>Você pode desativar lembretes nas preferências de email da área do aluno.</p>`,
    ),
    text: `Oi, ${name}! ${message} Acesse ${studentLoginUrl(teacherId, slug)}. Você pode desativar lembretes nas preferências da área do aluno.`,
  };
}
