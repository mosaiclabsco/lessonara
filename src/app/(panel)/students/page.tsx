import { ImportOnboarding } from "@/components/import-onboarding";
import { loadOnboarding } from "@/lib/onboarding";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { Suspense } from "react";
import PanelLoading from "../loading";
import { Dashboard } from "@/components/dashboard";
import { loadTeacherOverview } from "@/lib/teacher-overview";

export default function StudentsPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PageContent />
    </Suspense>
  );
}

async function PageContent() {
  const [state, overview] = await Promise.all([loadOnboarding(), loadTeacherOverview("directory")]);
  return (
    <>
      {!state.complete && <OnboardingGuide state={state} />}
      <ImportOnboarding state={state} />

      <Dashboard setupReady={state.ready} directoryOnly {...overview} />
    </>
  );
}
