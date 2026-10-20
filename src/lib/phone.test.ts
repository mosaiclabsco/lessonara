import { expect, it } from "vitest";
import { formatPhoneInput, initialPhone, normalizeStudentPhone } from "./phone";
import { paymentWhatsAppUrl } from "./whatsapp";
it("normaliza telefone brasileiro com DDI legado e nacional", () => {
  expect(normalizeStudentPhone("5511979604185", "BR")).toEqual({
    phone: "+5511979604185",
    phone_country: "BR",
  });
  expect(normalizeStudentPhone("(11) 97960-4185", "BR").phone).toBe("+5511979604185");
  expect(initialPhone("5511979604185")).toEqual({ country: "BR", value: "(11) 97960-4185" });
});
it.each([
  ["US", "(202) 555-0100", "+12025550100"],
  ["GB", "020 7946 0018", "+442079460018"],
  ["PT", "912 345 678", "+351912345678"],
  ["FR", "06 12 34 56 78", "+33612345678"],
])("salva país %s e número completo e usa esse DDI no WhatsApp", (country, phone, e164) => {
  expect(normalizeStudentPhone(phone, country)).toEqual({ phone: e164, phone_country: country });
  expect(new URL(paymentWhatsAppUrl(phone, country)!).pathname).toBe(`/${e164.slice(1)}`);
  expect(initialPhone(e164, country).country).toBe(country);
});
it("telefone opcional ainda preserva o país escolhido", () =>
  expect(normalizeStudentPhone("", "PT")).toEqual({ phone: null, phone_country: "PT" }));
it("não aceita código de país inexistente, número curto, ramal ou DDI divergente", () => {
  expect(() => normalizeStudentPhone("123", "BR")).toThrow();
  expect(() => normalizeStudentPhone("(202) 555-0100", "ZZ")).toThrow();
  expect(() => normalizeStudentPhone("+44 20 7946 0018", "BR")).toThrow();
  expect(() => normalizeStudentPhone("(202) 555-0100 ext. 123", "US")).toThrow();
});
it("colar número internacional atualiza o país e formata nacionalmente", () => {
  expect(formatPhoneInput("+442079460018", "BR")).toEqual({
    country: "GB",
    value: "020 7946 0018",
  });
  expect(formatPhoneInput("11979604185", "BR")).toEqual({
    country: "BR",
    value: "(11) 97960-4185",
  });
});
