import { SupportBanner } from "@/components/support-banner";
import { resolvePlatformPlan } from "@/lib/platform-plans";
import { PlatformPlanProvider } from "@/components/platform-plan-provider";
import PanelLoading from "./loading";
import { Suspense } from "react";
import { PanelNav, PanelNavFallback } from "@/components/panel-nav";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireUser } from "@/lib/supabase/server";
async function Workspace({ children }: LayoutProps<"/">) {
  const { teacher, claims } = await requireUser();
  const plan = resolvePlatformPlan(teacher.platform_plan);
  return (
    <PlatformPlanProvider plan={plan}>
      <WorkspaceShell
        name={teacher?.name ?? "Professor"}
        nav={
          <Suspense fallback={<PanelNavFallback />}>
            <PanelNav platformPlan={plan} />
          </Suspense>
        }
      >
        {typeof claims.support_actor === "string" &&
          typeof claims.session_expires_at === "number" && (
            <SupportBanner
              actor={claims.support_actor}
              name={teacher.name}
              expiresAt={claims.session_expires_at}
            />
          )}
        {children}
      </WorkspaceShell>
    </PlatformPlanProvider>
  );
}
export default function PanelLayout(props: LayoutProps<"/">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Workspace {...props} />
    </Suspense>
  );
}
