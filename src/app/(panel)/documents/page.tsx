import { loadOnboarding } from "@/lib/onboarding";
import { SetupRequired } from "@/components/onboarding-guide";
import { Suspense } from "react";
import PanelLoading from "../loading";
import { requireUser } from "@/lib/supabase/server";
import { nowInTZ } from "@/lib/dates";
import { loadDocumentLibrary } from "@/lib/documents";
import { DocumentLibrary } from "@/components/document-library";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <LibraryData />
    </Suspense>
  );
}

async function LibraryData() {
  const { supabase, userId } = await requireUser();
  if (!(await loadOnboarding()).ready) return <SetupRequired />;
  const { today } = nowInTZ();
  const library = await loadDocumentLibrary(supabase, userId, today, true);
  return (
    <DocumentLibrary
      documents={library.documents}
      submissionBytes={library.submissionBytes}
      ready={library.ready}
    />
  );
}
