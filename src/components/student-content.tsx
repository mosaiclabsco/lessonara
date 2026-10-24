import { loadStudentRenewal, type RenewalPlan } from "@/lib/renewals";
import { PlatformPlanProvider } from "./platform-plan-provider";
import { platformPlan } from "@/lib/platform-plans";
import { getJitsiConfig } from "@/lib/classroom-server";
import { loadActivities } from "@/lib/activities";
import { loadStudentShares } from "@/lib/documents";
import { connection } from "next/server";
import { authorizedStudent } from "@/lib/student-access";
import { notFound, redirect } from "next/navigation";
import { StudentPortal } from "@/components/student-portal";
import { nowInTZ } from "@/lib/dates";
import { loadLedgers, type Student } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/server";
export async function StudentContent({
  params,
}: Pick<PageProps<"/student/portal/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const access = await authorizedStudent(id);
  if (!access) redirect("/student/login");
  const supabase = createAdminClient();
  const { data: student, error } = await supabase
    .from("students")
    .select(
      "*, teachers!students_teacher_id_fkey(name,platform_plan,access_suspended),plans(price,lessons,name,is_active)",
    )
    .eq("id", access.id)
    .eq("teacher_id", access.teacher_id)
    .maybeSingle<
      Student &
        RenewalPlan & {
          teachers: {
            name: string;
            platform_plan: string;
            access_suspended: boolean;
          } | null;
        }
    >();
  if (error) throw error;
  if (!student) notFound();
  const { ledger, packages, today } = (await loadLedgers(supabase, [student.id])).get(student.id)!;
  const [shared, assigned, renewal] = await Promise.all([
    loadStudentShares(supabase, student.id, student.teacher_id, today, false),
    loadActivities(supabase, student.teacher_id, student.id),
    loadStudentRenewal(student.id, student.teacher_id, student),
  ]);
  const materials = shared.shares.map(({ id, title, subject, fileName, byteSize, expiresOn }) => ({
    id,
    title,
    subject,
    fileName,
    byteSize,
    expiresOn,
  }));
  const activities = assigned.activities.map(
    ({ studentId, studentName, documentId, ...activity }) => {
      void studentId;
      void studentName;
      void documentId;
      return activity;
    },
  );
  const plan = platformPlan(
    student.teachers?.access_suspended ? null : student.teachers?.platform_plan,
  );
  return (
    <PlatformPlanProvider plan={plan.id}>
      <StudentPortal
        emailPreferences={{
          operational: !Boolean(
            (student as Student & { operational_email_opt_out?: boolean })
              .operational_email_opt_out,
          ),
          promotional: !Boolean(
            (student as Student & { promotional_email_opt_out?: boolean })
              .promotional_email_opt_out,
          ),
        }}
        renewal={renewal}
        classroomEnabled={plan.classroom && Boolean(getJitsiConfig())}
        meetEnabled={plan.google}
        activities={activities}
        slug={student.id}
        materials={materials}
        name={student.name}
        teacherName={student.teachers?.name ?? ""}
        ledger={ledger}
        packages={packages}
        today={today}
        time={nowInTZ().time}
      />
    </PlatformPlanProvider>
  );
}
