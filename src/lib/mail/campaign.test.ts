import { expect, it } from "vitest";
import { validateCampaign } from "./campaign";
import { campaignEmail } from "./templates";
const id = "00000000-0000-4000-8000-000000000001";
const base = { id, subject: "Promoção", message: "Uma mensagem", students: [id] };
it("bounds campaign content and deduplicates recipients before queueing", () => {
  expect(validateCampaign({ ...base, students: [id, id] }).students).toEqual([id]);
  for (const input of [
    { ...base, subject: "x\nBcc: other@test" },
    { ...base, students: [] },
    { ...base, students: Array(101).fill(id) },
    { ...base, students: ["invalid"] },
    { ...base, message: "a".repeat(10001) },
    { ...base, id: "broken" },
    null,
  ])
    expect(() => validateCampaign(input)).toThrow();
});
it("campaign template escapes user content and includes cancellation without exposing other recipients", () => {
  const email = campaignEmail(
    "<Alice>",
    "Prof",
    "Promoção",
    "<script>alert(1)</script>",
    "https://lessonara.example/emails/unsubscribe?token=x",
  );
  expect(email.html).not.toContain("<script>");
  expect(email.html).toContain("&lt;script&gt;");
  expect(email.html).toContain("unsubscribe?token=x");
  expect(email.subject).toBe("Promoção");
});
