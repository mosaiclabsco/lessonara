import { ImportOnboarding } from "@/components/import-onboarding";
import { loadOnboarding } from "@/lib/onboarding";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { Suspense } from "react";
import PanelLoading from "../loading";
import { Dashboard } from "@/components/dashboard";
import { loadTeacherOverview } from "@/lib/teacher-overview";

export default function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PageContent({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const initialFilter = (await searchParams).filter;
  const [state, overview] = await Promise.all([loadOnboarding(), loadTeacherOverview("directory")]);
  return (
    <>
      {!state.complete && <OnboardingGuide state={state} />}
      <ImportOnboarding state={state} />

      <Dashboard
        key={initialFilter}
        initialFilter={initialFilter === "pending" ? "pending" : "all"}
        setupReady={state.ready}
        directoryOnly
        {...overview}
      />
    </>
  );
}
