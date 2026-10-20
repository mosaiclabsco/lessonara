import type { SupabaseClient } from "@supabase/supabase-js";
import { documentsSetupMissing } from "./document-rules";
export const ACTIVITY_BUCKET = "lessonara-activities";
export type Submission = {
  id: string;
  status: "uploading" | "ready" | "deleting" | "deleted";
  file_name: string;
  byte_size: number;
  submitted_at: string | null;
  submitted_late: boolean;
  note: string;
};
export type Activity = {
  id: string;
  title: string;
  instructions: string;
  assigned_at: string;
  due_on: string | null;
  reviewed_at: string | null;
  feedback: string;
  feedbackDocumentId?: string | null;
  feedbackDocumentName?: string | null;
  archived_at: string | null;
  studentId: string;
  studentName: string;
  documentId: string | null;
  documentName: string | null;
  submission: Submission | null;
};
export type ActivityDocument = { id: string; title: string; file_name: string };
export function activityStatus(
  activity: Pick<Activity, "archived_at" | "reviewed_at" | "due_on" | "submission">,
  today: string,
) {
  if (activity.archived_at) return "Arquivada";
  if (activity.reviewed_at) return "Conferida";
  if (activity.submission?.submitted_at)
    return activity.submission.submitted_late ? "Entregue após o prazo" : "Entregue";
  return activity.due_on && activity.due_on < today ? "Prazo vencido" : "Aguardando entrega";
}
type Row = {
  id: string;
  title: string;
  instructions: string;
  assigned_at: string;
  due_on: string | null;
  reviewed_at: string | null;
  feedback: string;
  archived_at: string | null;
  student_id: string;
  document_id: string | null;
  students: { name: string };
  documents: { file_name: string; status: string } | null;
  activity_feedback_documents:
    | { document_id: string; documents: { file_name: string; status: string } | null }
    | { document_id: string; documents: { file_name: string; status: string } | null }[]
    | null;
  activity_submissions: Submission | Submission[] | null;
};
export async function loadActivities(
  supabase: SupabaseClient,
  teacherId: string,
  studentId?: string,
) {
  const activities: Activity[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase
      .from("activities")
      .select(
        "id,title,instructions,assigned_at,due_on,reviewed_at,feedback,archived_at,student_id,document_id,students!inner(name),documents(file_name,status),activity_feedback_documents(document_id,documents(file_name,status)),activity_submissions(id,status,file_name,byte_size,submitted_at,submitted_late,note)",
      )
      .eq("teacher_id", teacherId);
    if (studentId) query = query.eq("student_id", studentId);
    const { data, error } = await query
      .order("assigned_at", { ascending: false })
      .order("id")
      .range(offset, offset + 999)
      .returns<Row[]>();
    if (documentsSetupMissing(error)) return { ready: false, activities: [] as Activity[] };
    if (error) throw error;
    const rows = data ?? [];
    activities.push(
      ...rows.map((row) => ({
        id: row.id,
        title: row.title,
        instructions: row.instructions,
        assigned_at: row.assigned_at,
        due_on: row.due_on,
        reviewed_at: row.reviewed_at,
        feedback: row.feedback,
        feedbackDocumentId:
          (Array.isArray(row.activity_feedback_documents)
            ? row.activity_feedback_documents[0]
            : row.activity_feedback_documents
          )?.document_id ?? null,
        feedbackDocumentName:
          (Array.isArray(row.activity_feedback_documents)
            ? row.activity_feedback_documents[0]
            : row.activity_feedback_documents
          )?.documents?.status === "ready"
            ? (Array.isArray(row.activity_feedback_documents)
                ? row.activity_feedback_documents[0]
                : row.activity_feedback_documents
              )?.documents?.file_name
            : null,
        archived_at: row.archived_at,
        studentId: row.student_id,
        studentName: row.students.name,
        documentId: row.documents?.status === "ready" ? row.document_id : null,
        documentName: row.documents?.status === "ready" ? row.documents.file_name : null,
        submission: Array.isArray(row.activity_submissions)
          ? (row.activity_submissions[0] ?? null)
          : row.activity_submissions,
      })),
    );
    if (rows.length < 1000) break;
  }
  return { ready: true, activities };
}
