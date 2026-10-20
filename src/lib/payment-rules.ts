export type PaymentStatus = "pending" | "soon" | "ok";

export function paymentStatus(remaining: number): PaymentStatus {
  return remaining <= 0 ? "pending" : remaining <= 2 ? "soon" : "ok";
}

export function paymentMessage(name: string, remaining: number, link: string) {
  const balance =
    remaining < 0
      ? `há ${-remaining} aula(s) utilizada(s) além do pacote pago`
      : remaining === 0
        ? "seu pacote de aulas acabou"
        : `restam ${remaining} aula(s) no seu pacote`;
  return `Olá, ${name}! Passando para lembrar que ${balance}. Vamos combinar a renovação? Você pode acompanhar suas aulas aqui: ${link}`;
}

export function escapeEmailHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}
