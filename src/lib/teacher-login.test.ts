import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),signin:vi.fn(),client:vi.fn(),redirect:vi.fn(),headers:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:m.redirect}));
vi.mock("next/headers",()=>({headers:m.headers}));
vi.mock("@/lib/supabase/server",()=>({createAdminClient:()=>({rpc:m.rpc}),createClient:m.client}));
import {signIn} from "@/app/login/actions";
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv("EMAIL_ENCRYPTION_KEY","01".repeat(32));vi.stubEnv("VERCEL","1");
 m.headers.mockResolvedValue({get:()=>"192.0.2.1"});m.rpc.mockResolvedValue({data:true,error:null});
 m.client.mockResolvedValue({auth:{signInWithPassword:m.signin}});m.signin.mockResolvedValue({error:null});
 m.redirect.mockImplementation(()=>{throw new Error("REDIRECT");});
});
afterEach(()=>vi.unstubAllEnvs());
function form(){const f=new FormData();f.set("email","  ALICE@example.com  ");f.set("password","test-password");return f;}
it("normaliza o email e só chama Auth após o contador permitir",async()=>{
 await expect(signIn(null,form())).rejects.toThrow("REDIRECT");
 expect(m.signin).toHaveBeenCalledWith({email:"alice@example.com",password:"test-password"});
 expect(m.rpc).toHaveBeenCalledOnce();expect(m.redirect).toHaveBeenCalledWith("/");
});
it.each([{data:false,error:null},{data:null,error:{message:"offline"}}])("contador recusado ou indisponível bloqueia antes de validar a senha",async result=>{
 m.rpc.mockResolvedValue(result);expect((await signIn(null,form()))?.error).toContain("tentativas");
 expect(m.client).not.toHaveBeenCalled();expect(m.signin).not.toHaveBeenCalled();
});
it("falha do serviço de limite não libera o Auth",async()=>{
 m.rpc.mockRejectedValue(new Error("network"));expect((await signIn(null,form()))?.error).toContain("Tente novamente");expect(m.signin).not.toHaveBeenCalled();
});
it("email inexistente ou senha incorreta recebem a mesma mensagem",async()=>{
 for(const message of ["Invalid login credentials","Email not confirmed"]){m.signin.mockResolvedValue({error:{message}});expect((await signIn(null,form()))?.error).toBe("Email ou senha inválidos.");}
});
