import { loadOnboarding } from "@/lib/onboarding";
import { SetupNotice } from "./onboarding-guide";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActivities, type ActivityDocument } from "@/lib/activities";
import { TeacherActivities } from "./teacher-activities";
export async function StudentActivitySection({
  supabase,
  teacherId,
  studentId,
  studentName,
  today,
}: {
  supabase: SupabaseClient;
  teacherId: string;
  studentId: string;
  studentName: string;
  today: string;
}) {
  if (!(await loadOnboarding()).ready) return <SetupNotice />;
  const [loaded, documents] = await Promise.all([
    loadActivities(supabase, teacherId, studentId),
    supabase
      .from("documents")
      .select("id,title,file_name")
      .eq("teacher_id", teacherId)
      .eq("status", "ready")
      .order("title")
      .returns<ActivityDocument[]>(),
  ]);
  return (
    <TeacherActivities
      activities={loaded.activities}
      documents={documents.data ?? []}
      students={[{ id: studentId, name: studentName, active: true }]}
      studentId={studentId}
      today={today}
      ready={loaded.ready}
    />
  );
}
