import {expect,it} from "vitest";
import {validCronAuthorization} from "./cron-auth";
it("cron só aceita o Bearer completo com segredo configurado",()=>{
  expect(validCronAuthorization("Bearer abc", "abc")).toBe(true);
  for(const header of [null,"","abc","bearer abc","Bearer ab","Bearer abcX","Bearer "+"x".repeat(5000)])expect(validCronAuthorization(header,"abc")).toBe(false);
  expect(validCronAuthorization("Bearer undefined",undefined)).toBe(false);
  expect(validCronAuthorization("Bearer ","")).toBe(false);
});
