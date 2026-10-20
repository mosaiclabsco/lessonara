import { normalizeStudentPhone, phoneCountry, initialPhone } from "./phone";
export const DEFAULT_WHATSAPP_MESSAGE =
  "Olá! Tudo bem? Seu pacote de aulas está chegando ao fim. Podemos combinar a renovação para dar continuidade às aulas? Obrigado(a)!";
export function paymentWhatsAppUrl(
  phone: string,
  country?: string,
  message = DEFAULT_WHATSAPP_MESSAGE,
) {
  if (!phone.trim()) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  try {
    const normalized = normalizeStudentPhone(
      phone,
      country ? phoneCountry(country) : initialPhone(phone).country,
    );
    return `https://wa.me/${normalized.phone!.slice(1)}?text=${encodeURIComponent(message)}`;
  } catch {
    return null;
  }
}
