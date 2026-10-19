import {expect,it} from "vitest";
import {securityHeaders} from "./security-headers";
it("bloqueia enquadramento e objetos, mantendo apenas integrações configuradas",()=>{
  const headers=Object.fromEntries(securityHeaders("https://meet.example.test/path","https://project.supabase.co").map(h=>[h.key,h.value]));
  expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
  expect(headers["Content-Security-Policy"]).toContain("connect-src 'self' https://meet.example.test wss://meet.example.test https://project.supabase.co wss://project.supabase.co");
  expect(headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
  expect(headers["Permissions-Policy"]).toContain('camera=(self "https://meet.example.test")');
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");expect(headers["X-Frame-Options"]).toBe("DENY");
});
it("sem integração não libera uma origem genérica nem enfraquece os bloqueios",()=>{
  expect(securityHeaders().find(h=>h.key==="Content-Security-Policy")?.value).toContain("frame-src 'self';");
  expect(()=>securityHeaders("https://meet.example.test\nscript-src *")).toThrow();
  expect(()=>securityHeaders("http://unsafe.example")).toThrow();
});
