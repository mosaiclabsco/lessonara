import { expect, it } from "vitest";
import { settingsTab, settingsHref } from "./settings-navigation";
it("normalizes untrusted tabs and preserves direct navigation to each panel", () => {
  expect(settingsTab("unknown")).toBe("general");
  expect(settingsTab(["plans"])).toBe("general");
  expect(settingsTab("plans")).toBe("plans");
  expect(settingsHref("holidays")).toBe("/settings?tab=holidays#holidays");
});
