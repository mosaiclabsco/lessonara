import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export function phoneCountry(value?: string | null): CountryCode {
  return value && isSupportedCountry(value as CountryCode) ? (value as CountryCode) : "BR";
}

/** Aceita legado brasileiro com DDI sem +; novas gravações sempre usam E.164. */
export function parseStudentPhone(raw: string, country: CountryCode) {
  const value = raw.trim();
  if (!value) return null;
  let parsed = parsePhoneNumberFromString(value, { defaultCountry: country, extract: false });
  if (!value.startsWith("+") && !parsed?.isValid()) {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith(getCountryCallingCode(country))) {
      const international = parsePhoneNumberFromString(`+${digits}`, { extract: false });
      if (international?.isValid() && international.country === country) parsed = international;
    }
  }
  return parsed;
}

export function normalizeStudentPhone(raw: string, countryValue: string) {
  if (!isSupportedCountry(countryValue as CountryCode))
    throw new Error("Selecione o país do telefone.");
  const country = countryValue as CountryCode;
  if (!raw.trim()) return { phone: null, phone_country: country };
  const parsed = parseStudentPhone(raw, country);
  if (!parsed?.isValid() || parsed.ext) throw new Error("Confira o telefone e o código do país.");
  if (
    parsed.countryCallingCode !== getCountryCallingCode(country) ||
    (parsed.country && parsed.country !== country)
  )
    throw new Error("O telefone não corresponde ao país selecionado.");
  return { phone: parsed.number, phone_country: country };
}

export function initialPhone(raw?: string | null, savedCountry?: string | null) {
  const country = phoneCountry(savedCountry);
  if (!raw) return { country, value: "" };
  const parsed = parseStudentPhone(raw, country);
  return {
    country: parsed?.country ?? country,
    value: parsed?.isValid() ? parsed.formatNational() : raw,
  };
}

export function formatPhoneInput(raw: string, country: CountryCode) {
  if (raw.trim().startsWith("+")) {
    const formatter = new AsYouType();
    const international = formatter.input(raw);
    const detected = formatter.getCountry();
    if (detected) {
      const national = formatter.getNumber()?.nationalNumber ?? "";
      return {
        country: detected,
        value: formatter.getNumber()?.formatNational() ?? new AsYouType(detected).input(national),
      };
    }
    return { country, value: international };
  }
  return { country, value: new AsYouType(country).input(raw) };
}
