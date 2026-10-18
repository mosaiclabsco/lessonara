import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  cookies: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

import { createClient,requireUser } from "./server";

beforeEach(() => vi.resetAllMocks());

it("aguarda uma requisição antes de inicializar o auth do Supabase", async () => {
  let acceptRequest!: () => void;
  mocks.connection.mockReturnValue(new Promise<void>((resolve) => { acceptRequest = resolve; }));
  mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
  const client = { auth: {} };
  mocks.createServerClient.mockReturnValue(client);

  const pending = createClient();
  expect(mocks.connection).toHaveBeenCalledOnce();
  expect(mocks.cookies).not.toHaveBeenCalled();
  expect(mocks.createServerClient).not.toHaveBeenCalled();

  acceptRequest();
  expect(await pending).toBe(client);
  expect(mocks.cookies).toHaveBeenCalledOnce();
  expect(mocks.createServerClient).toHaveBeenCalledOnce();
});

it("returns the authorized teacher profile from the same membership read",async()=>{
 mocks.connection.mockResolvedValue(undefined);mocks.cookies.mockResolvedValue({getAll:()=>[],set:vi.fn()});
 const teacher={id:"teacher",name:"Prof",lesson_minutes:60,platform_plan:"pro"};
 const maybeSingle=vi.fn().mockResolvedValue({data:teacher,error:null});
 const select=vi.fn(()=>({eq:vi.fn(()=>({maybeSingle}))}));
 const client={auth:{getClaims:async()=>({data:{claims:{sub:"teacher"}}})},from:vi.fn(()=>({select}))};
 mocks.createServerClient.mockReturnValue(client);
 const account=await requireUser();expect(account.teacher).toBe(teacher);expect(account.userId).toBe("teacher");expect(client.from).toHaveBeenCalledOnce();
});
it("rejects an authenticated account without teacher membership",async()=>{
 mocks.connection.mockResolvedValue(undefined);mocks.cookies.mockResolvedValue({getAll:()=>[],set:vi.fn()});
 mocks.createServerClient.mockReturnValue({auth:{getClaims:async()=>({data:{claims:{sub:"student"}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})});
 await expect(requireUser()).rejects.toThrow("Acesso de professor");
});
