/** Read-only check of the actual profile selectors against the configured database. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
const studentId = process.argv[process.argv.indexOf("--student-id") + 1];
if (!process.argv.includes("--student-id") || !/^[a-f\d-]{36}$/i.test(studentId ?? ""))
  throw Error(
    "Use --student-id UUID of an existing test student with a portal session. This check never creates records.",
  );
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw Error("Load the private backend environment first.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const target = await db
  .from("students")
  .select("id,teacher_id")
  .eq("id", studentId)
  .eq("active", true)
  .single();
if (target.error || !target.data) throw Error("Test student not found or inactive.");
for (const file of [
  "src/components/student-content.tsx",
  "src/lib/mail/reminders.ts",
  "src/lib/mail/outbox.ts",
  "src/app/student/page.tsx",
]) {
  const path = new URL("../../" + file, import.meta.url);
  const source = ts.createSourceFile(
    file,
    await readFile(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const selectors: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "select" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text.includes("teachers")
    )
      selectors.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (selectors.length !== 1) throw Error("Review the profile selector in " + fileURLToPath(path));
  const sessions = file === "src/app/student/page.tsx";
  let query = db.from(sessions ? "student_session_links" : "students").select(selectors[0]);
  query = sessions
    ? query.eq("student_id", target.data.id)
    : query.eq("id", target.data.id).eq("teacher_id", target.data.teacher_id);
  const result = await query.limit(1);
  if (result.error) throw Error(`${file}: ${result.error.code} ${result.error.message}`);
  if (!result.data?.length) throw Error("A linked test portal session is required for " + file);
  const row = result.data[0] as unknown as {
    teachers?: unknown;
    students?: { teachers?: unknown };
  };
  const teacher = sessions ? row.students?.teachers : row.teachers;
  if (!teacher || Array.isArray(teacher))
    throw Error("Expected exactly one owning teacher for " + file);
  console.log(JSON.stringify({ query: file, status: "passed", relationship: "single owner" }));
}
