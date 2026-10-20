import { loadOnboarding } from "@/lib/onboarding";
import { SetupNotice } from "./onboarding-guide";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDocumentLibrary, loadStudentShares } from "@/lib/documents";
import { StudentDocumentSharing } from "./student-document-sharing";

export async function StudentDocuments({
  supabase,
  studentId,
  teacherId,
  today,
}: {
  supabase: SupabaseClient;
  studentId: string;
  teacherId: string;
  today: string;
}) {
  if (!(await loadOnboarding()).ready) return <SetupNotice />;
  const [library, shared] = await Promise.all([
    loadDocumentLibrary(supabase, teacherId, today),
    loadStudentShares(supabase, studentId, teacherId, today),
  ]);
  return (
    <StudentDocumentSharing
      studentId={studentId}
      documents={library.documents.filter((document) => document.status === "ready")}
      shares={shared.shares}
      today={today}
      ready={library.ready && shared.ready}
    />
  );
}
