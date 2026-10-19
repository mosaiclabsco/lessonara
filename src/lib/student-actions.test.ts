import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({access:vi.fn(),admin:vi.fn(),rpc:vi.fn(),plan:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createAdminClient:m.admin}));
vi.mock("@/lib/activity-access",()=>({studentActivity:m.access}));
vi.mock("@/lib/platform-plan-server",()=>({loadTeacherPlan:m.plan}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {beginActivitySubmission,finishActivitySubmission,cancelActivitySubmission} from "@/app/student/actions";
beforeEach(()=>{vi.resetAllMocks();m.admin.mockReturnValue({rpc:m.rpc});m.access.mockResolvedValue(null);});
it("as três actions recusam IDs sem vínculo de sessão antes de gravar ou assinar upload",async()=>{
 expect((await beginActivitySubmission("other","activity",{fileName:"test.pdf",byteSize:1})).ok).toBe(false);
 expect((await finishActivitySubmission("other","activity","submission","")).ok).toBe(false);
 expect((await cancelActivitySubmission("other","activity")).ok).toBe(false);
 expect(m.rpc).not.toHaveBeenCalled();expect(m.access).toHaveBeenCalledWith(expect.anything(),"other","activity");
});
