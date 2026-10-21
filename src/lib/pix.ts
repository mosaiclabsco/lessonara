import { FormValidationError, textValue } from "./form-validation";
export type PixSettings = {
  key_type: string;
  pix_key: string;
  receiver_name: string;
  receiver_city: string;
};
const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/ +/g, " ")
    .trim();
function taxIdValid(digits: string) {
  if (/^(.)\1+$/.test(digits)) return false;
  const calc = (s: string, weights: number[]) => {
    const sum = [...s].reduce((n, d, i) => n + Number(d) * weights[i], 0);
    const v = 11 - (sum % 11);
    return v >= 10 ? 0 : v;
  };
  if (digits.length === 11)
    return (
      calc(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[9]) &&
      calc(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[10])
    );
  return (
    digits.length === 14 &&
    calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12]) &&
    calc(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13])
  );
}
export function validatePix(input: PixSettings): PixSettings {
  const type = textValue(input.key_type, "key_type", 10, true);
  let key = textValue(input.pix_key, "pix_key", 77, true);
  let valid = false;
  if (type === "cpf" || type === "cnpj") {
    key = key.replace(/[.\/ -]/g, "");
    valid = new RegExp(`^\\d{${type === "cpf" ? 11 : 14}}$`).test(key) && taxIdValid(key);
  }
  if (type === "email") {
    key = key.toLowerCase();
    valid = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(key);
  }
  if (type === "phone") {
    key = key.replace(/[() -]/g, "");
    valid = /^\+[1-9]\d{7,14}$/.test(key);
  }
  if (type === "random") {
    key = key.toLowerCase();
    valid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key);
  }
  if (!valid)
    throw new FormValidationError(
      "pix_key",
      "Confira a chave Pix e o tipo escolhido. Telefone deve incluir + e código do país.",
    );
  const name = plain(textValue(input.receiver_name, "receiver_name", 120, true));
  const city = plain(textValue(input.receiver_city, "receiver_city", 120, true));
  if (!name || name.length > 25)
    throw new FormValidationError(
      "receiver_name",
      "Informe o nome do recebedor com até 25 caracteres, sem acentos.",
    );
  if (!city || city.length > 15)
    throw new FormValidationError(
      "receiver_city",
      "Informe a cidade com até 15 caracteres, sem acentos.",
    );
  return { key_type: type, pix_key: key, receiver_name: name, receiver_city: city };
}
export function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function pixPayload(settings: PixSettings, amount: number, txid = "***") {
  const s = validatePix(settings);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 99000 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
  )
    throw new Error("Valor Pix inválido.");
  if (txid !== "***" && !/^[a-zA-Z0-9]{1,25}$/.test(txid))
    throw new Error("Identificador Pix inválido.");
  const tlv = (id: string, value: string) =>
    id + String(new TextEncoder().encode(value).length).padStart(2, "0") + value;
  const body =
    tlv("00", "01") +
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", s.pix_key)) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", s.receiver_name) +
    tlv("60", s.receiver_city) +
    tlv("62", tlv("05", txid)) +
    "6304";
  return body + crc16(body);
}
export type RenewalQuote = {
  id: string;
  student_id: string;
  teacher_id: string;
  plan_name: string;
  amount: number;
  lessons: number;
  pix: PixSettings;
  status: "ready" | "pending" | "confirmed" | "rejected" | "cancelled";
  created_at: string;
  reported_at: string | null;
  resolved_at: string | null;
  package_id: string | null;
  resolution_note: string | null;
};
