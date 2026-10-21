import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { pixPayload, crc16, validatePix } from "./pix";
const settings = {
  key_type: "random",
  pix_key: "123e4567-e12b-12d1-a456-426655440000",
  receiver_name: "Fulano de Tal",
  receiver_city: "BRASILIA",
};
function fields(payload: string) {
  const result: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const key = payload.slice(i, i + 2),
      len = Number(payload.slice(i + 2, i + 4));
    result[key] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return result;
}
describe("Pix estático", () => {
  it("matches the published BCB CRC example", () => {
    const sample =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(sample)).toBe("1D3D");
  });
  it("encodes price, key and reference with valid CRC", () => {
    const payload = pixPayload(settings, 222.22, "RENOVACAO123");
    const f = fields(payload);
    expect(f["54"]).toBe("222.22");
    expect(f["53"]).toBe("986");
    expect(fields(f["26"])["01"]).toBe(settings.pix_key);
    expect(fields(f["62"])["05"]).toBe("RENOVACAO123");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
    expect(f["59"]).toBe("FULANO DE TAL");
  });
  it("does not turn zero into an open-amount charge", () => {
    for (const amount of [0, -1, NaN, Infinity, 99000.01, 0.001])
      expect(() => pixPayload(settings, amount)).toThrow();
    expect(fields(pixPayload(settings, 99000))["54"]).toBe("99000.00");
  });
  it("validates tax IDs, phone, email and random keys", () => {
    for (const key of ["11111111111", "12345678900"])
      expect(() => validatePix({ ...settings, key_type: "cpf", pix_key: key })).toThrow();
    expect(validatePix({ ...settings, key_type: "cpf", pix_key: "529.982.247-25" }).pix_key).toBe(
      "52998224725",
    );
    expect(
      validatePix({ ...settings, key_type: "cnpj", pix_key: "11.222.333/0001-81" }).pix_key,
    ).toBe("11222333000181");
    expect(() => validatePix({ ...settings, key_type: "phone", pix_key: "11999999999" })).toThrow();
    expect(
      validatePix({ ...settings, key_type: "phone", pix_key: "+55 (11) 99999-9999" }).pix_key,
    ).toBe("+5511999999999");
    expect(() => validatePix({ ...settings, key_type: "email", pix_key: "a@bad" })).toThrow();
    expect(() => validatePix({ ...settings, key_type: "other" })).toThrow();
  });
  it("normalizes receiver accents and rejects empty or oversized names", () => {
    expect(
      validatePix({ ...settings, receiver_name: "João Silva", receiver_city: "São Paulo" })
        .receiver_name,
    ).toBe("JOAO SILVA");
    expect(() => validatePix({ ...settings, receiver_name: " ".repeat(5) })).toThrow();
    expect(() => validatePix({ ...settings, receiver_city: "X".repeat(16) })).toThrow();
  });
  it("generates a QR symbol from the exact copy-and-paste payload", async () => {
    const payload = pixPayload(settings, 300);
    const symbol = QRCode.create(payload, { errorCorrectionLevel: "M" });
    expect(symbol.segments.map((s) => s.mode.id)).toContain("Byte");
    expect(symbol.modules.size).toBeGreaterThan(21);
    const svg = await QRCode.toString(payload, { type: "svg", margin: 4 });
    expect(svg).toContain("<svg");
    expect(svg).not.toContain(settings.receiver_name);
  });
});

it("decodes rendered pixels back to the same Pix with an independent reader", () => {
  const payload = pixPayload(settings, 222.22, "RENOVACAO123");
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const scale = 6,
    margin = 4,
    size = (qr.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / scale) - margin,
        col = Math.floor(x / scale) - margin;
      const dark =
        row >= 0 &&
        col >= 0 &&
        row < qr.modules.size &&
        col < qr.modules.size &&
        qr.modules.get(row, col);
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = dark ? 0 : 255;
      pixels[index + 3] = 255;
    }
  expect(jsQR(pixels, size, size)?.data).toBe(payload);
});
