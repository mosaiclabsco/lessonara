import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
if (process.env.QA_ACK !== "ISOLATED_FIXTURES_IN_PRODUCTION")
  throw Error(
    "Set QA_ACK=ISOLATED_FIXTURES_IN_PRODUCTION only for an authorized production QA run.",
  );
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = process.env.APP_URL || "https://lessonara.mosaic-labs.co";
const run = randomBytes(6).toString("hex");
const created = [];
const objects = [];
const rows = [];
let checks = 0;
function expect(condition, label) {
  if (!condition) throw Error(label);
  checks++;
  console.log("PASS", label);
}
function value(result, label) {
  if (result.error) throw Error(label + ": " + result.error.code);
  return result.data;
}
function record() {
  writeFileSync(
    process.env.QA_FIXTURE_INVENTORY || "/private/tmp/lessonara-qa-fixtures.json",
    JSON.stringify({ created, objects, run }),
    { mode: 0o600 },
  );
}
async function response(path, cookie, opts = {}) {
  return fetch(base + path, {
    redirect: "manual",
    ...opts,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) },
  });
}
try {
  for (const plan of ["essential", "plus", "pro"]) {
    const email = `qa-permissions-${run}-${plan}@example.invalid`;
    const user = value(
      await admin.auth.admin.createUser({
        email,
        password: randomBytes(32).toString("base64url"),
        email_confirm: true,
        user_metadata: { name: "QA permissions " + plan },
      }),
      "Create synthetic teacher",
    ).user;
    created.push(user.id);
    record();
    value(
      await admin
        .from("teachers")
        .update({
          platform_plan: plan,
          profile_completed_at: new Date().toISOString(),
          lesson_minutes: 60,
        })
        .eq("id", user.id),
      "Prepare synthetic teacher",
    );
    const packagePlan = value(
      await admin
        .from("plans")
        .insert({
          teacher_id: user.id,
          name: "QA isolated plan",
          lessons: 4,
          price: 10000,
          is_active: true,
        })
        .select("id")
        .single(),
      "Create synthetic plan",
    );
    const student = value(
      await admin
        .from("students")
        .insert({
          teacher_id: user.id,
          plan_id: packagePlan.id,
          slug: `qa-${run}-${plan}`,
          name: "QA isolated student",
          email: `qa-student-${run}-${plan}@example.invalid`,
          active: false,
        })
        .select("id")
        .single(),
      "Create synthetic student",
    );
    let jar = [];
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => jar,
        setAll: (values) => {
          for (const item of values) {
            jar = jar.filter((old) => old.name !== item.name);
            jar.push(item);
          }
        },
      },
    });
    const link = value(
      await admin.auth.admin.generateLink({ type: "magiclink", email }),
      "Generate synthetic sign-in without sending email",
    );
    value(
      await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" }),
      "Verify synthetic sign-in",
    );
    const cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");
    if (!cookie) throw Error("Synthetic session cookie missing");
    rows.push({ plan, id: user.id, student: student.id, client, cookie });
  }
  for (const row of rows) {
    const own = value(
      await row.client.from("students").select("id").eq("id", row.student),
      "Read own synthetic student",
    );
    expect(own.length === 1, `${row.plan}: own tenant accessible through RLS`);
    const other = rows.find((r) => r.id !== row.id);
    const reserve = (id, size) =>
      row.client.rpc("reserve_document_upload", {
        p_id: id,
        p_title: "QA isolated file",
        p_subject: "QA",
        p_file_name: "qa.txt",
        p_storage_path: `${row.id}/${id}/file.txt`,
        p_mime_type: "text/plain",
        p_byte_size: size,
      });
    const max = (row.plan === "essential" ? 20 : 50) * 1024 * 1024;
    const excessive = await reserve(randomUUID(), max + 1);
    expect(
      Boolean(excessive.error),
      `${row.plan}: database rejects file above effective size limit`,
    );
    const boundary = randomUUID();
    value(await reserve(boundary, max), "Reserve exact file limit");
    value(
      await row.client.from("documents").delete().eq("id", boundary),
      "Remove unused synthetic reservation",
    );
    expect(true, `${row.plan}: database accepts exact effective file size limit`);
    const document = randomUUID(),
      path = `${row.id}/${document}/file.txt`;
    const content = Buffer.from("Lessonara isolated permissions fixture");
    value(await reserve(document, content.length), "Reserve small synthetic file");
    objects.push(path);
    record();
    value(
      await row.client.storage
        .from("lessonara-documents")
        .upload(path, content, { contentType: "text/plain", upsert: false }),
      "Upload small synthetic file",
    );
    value(
      await row.client.from("documents").update({ status: "ready" }).eq("id", document),
      "Mark synthetic file ready",
    );
    const ownDownload = await response(`/documents/${document}/file`, row.cookie);
    const signed = ownDownload.headers.get("location");
    if (ownDownload.status !== 303 || !signed || new URL(signed).origin !== new URL(url).origin)
      throw Error("Own file must redirect only to the configured signed Storage URL");
    const file = await fetch(signed);
    expect(
      file.status === 200 && (await file.text()) === content.toString(),
      `${row.plan}: own authenticated file download succeeds`,
    );
    const foreignDownload = await response(`/documents/${document}/file`, other.cookie);
    expect(
      [403, 404].includes(foreignDownload.status),
      `${row.plan}: foreign authenticated file download denied`,
    );
    const foreignStorage = await other.client.storage.from("lessonara-documents").download(path);
    expect(Boolean(foreignStorage.error), `${row.plan}: direct foreign Storage download denied`);
    const foreign = value(
      await row.client.from("students").select("id").eq("id", other.student),
      "Foreign tenant read",
    );
    expect(foreign.length === 0, `${row.plan}: foreign tenant hidden through RLS`);
    const changed = await row.client
      .from("students")
      .update({ name: "FORGED" })
      .eq("id", other.student)
      .select("id");
    expect(
      !changed.error && changed.data.length === 0,
      `${row.plan}: foreign tenant update denied`,
    );
    const privileged = await row.client
      .from("teachers")
      .update({ platform_plan: "pro" })
      .eq("id", row.id);
    expect(Boolean(privileged.error), `${row.plan}: browser cannot change its platform plan`);
    const exportResponse = await response("/finance/export?format=csv&period=2026-10", row.cookie);
    expect(
      exportResponse.status === (row.plan === "essential" ? 403 : 200),
      `${row.plan}: direct financial export permission`,
    );
    await exportResponse.arrayBuffer();
    const google = await response("/integrations/google/connect", row.cookie);
    expect(
      row.plan === "essential"
        ? google.status === 403
        : google.status === 307 &&
            google.headers.get("location")?.startsWith("https://accounts.google.com/"),
      `${row.plan}: direct Google authorization permission`,
    );
    const target = `/classroom/${other.student}/appointment/${randomUUID()}/2026-10-31/join`;
    const classroom = await response(target, row.cookie, {
      method: "POST",
      headers: { Origin: base },
    });
    expect(classroom.status === 403, `${row.plan}: direct foreign classroom denied`);
    const foreignPage = await response(`/students/${other.student}`, row.cookie);
    const text = await foreignPage.text();
    expect(
      (foreignPage.status === 404 || text.includes("NEXT_HTTP_ERROR_FALLBACK;404")) &&
        !text.includes("FORGED"),
      `${row.plan}: foreign student page denied`,
    );
  }
  for (const path of [
    "/finance/export?format=csv&period=2026-10",
    "/integrations/google/connect",
  ]) {
    const r = await response(path);
    expect(
      [302, 303, 307, 308].includes(r.status) && r.headers.get("location")?.includes("/login"),
      "Anonymous direct request requires sign-in",
    );
  }
  const count = await admin
    .from("email_outbox")
    .select("id", { count: "exact", head: true })
    .in("teacher_id", created);
  value(count, "Read fixture email count");
  expect(count.count === 0, "Synthetic tests queued no emails");
  console.log(
    JSON.stringify({
      result: "passed",
      checks,
      plans: rows.map((r) => r.plan),
      realEmailsSent: 0,
      realPaymentsCreated: 0,
    }),
  );
} catch (e) {
  console.error("VALIDATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  if (objects.length) {
    const removed = await admin.storage.from("lessonara-documents").remove(objects);
    if (removed.error) {
      console.error("Synthetic file cleanup failed; private path inventory retained.");
      process.exitCode = 1;
    } else console.log("Synthetic storage objects removed:", objects.length);
  }
  for (const id of created.reverse()) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) {
      console.error("Fixture cleanup failed; private ID inventory retained.");
      process.exitCode = 1;
    }
  }
  const remaining = created.length
    ? await admin.from("teachers").select("id", { count: "exact", head: true }).in("id", created)
    : { count: 0 };
  console.log("Synthetic teachers remaining:", remaining.count);
}
