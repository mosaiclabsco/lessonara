import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { previewImport } from "../src/lib/import-rules.ts";
import type { Plan } from "../src/lib/data.ts";
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [command, id, path] = process.argv.slice(2);
  function check(error: { message: string } | null) {
    if (error) throw new Error(error.message);
  }
  if (command === "list") {
    const result = await db
      .from("student_imports")
      .select("id,mode,status,filename,created_at,revision,object_path")
      .or("status.in.(waiting,review),object_path.not.is.null")
      .order("created_at");
    check(result.error);
    console.table(
      result.data?.map(({ object_path, ...row }) => ({
        ...row,
        cleanup_pending: Boolean(object_path && ["completed", "cancelled"].includes(row.status)),
      })),
    );
  } else if ((command === "download" || command === "prepare" || command === "cleanup") && id) {
    const result = await db
      .from("student_imports")
      .select("id,teacher_id,object_path,status,filename")
      .eq("id", id)
      .single();
    check(result.error);
    const batch = result.data!;
    if (command === "download") {
      if (!path || !batch.object_path)
        throw new Error("Informe o caminho local e confira se o pedido tem original.");
      const downloaded = await db.storage.from("lessonara-imports").download(batch.object_path);
      check(downloaded.error);
      await writeFile(path, Buffer.from(await downloaded.data!.arrayBuffer()), {
        mode: 0o600,
        flag: "wx",
      });
      console.log("Arquivo salvo com acesso restrito. Revise localmente, sem serviços externos.");
    } else if (command === "prepare") {
      if (!path || !["waiting", "review"].includes(batch.status))
        throw new Error("Informe o CSV preparado de um pedido aberto.");
      const [plans, students] = await Promise.all([
        db
          .from("plans")
          .select("*")
          .eq("teacher_id", batch.teacher_id)
          .eq("is_active", true)
          .returns<Plan[]>(),
        db.from("students").select("name,email").eq("teacher_id", batch.teacher_id).limit(1000),
      ]);
      check(plans.error);
      check(students.error);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const preview = previewImport(
        await readFile(path, "utf8"),
        plans.data ?? [],
        students.data ?? [],
        today,
      );
      const staged = await db.rpc("stage_student_import", {
        p_id: id,
        p_preview: preview,
        p_note:
          "Planilha preparada pela equipe. Revise os dados e selecione as linhas antes de confirmar.",
      });
      check(staged.error);
      console.log(
        `Prévia preparada: ${preview.length} linhas, ${preview.filter((r) => r.error).length} com erro. Nenhum aluno criado; confirmação exclusiva do professor.`,
      );
    } else {
      if (!["completed", "cancelled"].includes(batch.status))
        throw new Error("A limpeza só remove originais de pedidos encerrados.");
      if (batch.object_path) {
        check((await db.storage.from("lessonara-imports").remove([batch.object_path])).error);
        check(
          (
            await db
              .from("student_imports")
              .update({ object_path: null })
              .eq("id", id)
              .eq("object_path", batch.object_path)
          ).error,
        );
      }
      console.log("Original do pedido encerrado removido.");
    }
  } else
    throw new Error(
      "Uso: import-support list | download ID DESTINO | prepare ID CSV | cleanup ID. Carregue .env.local apenas em computador autorizado.",
    );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha na operação de suporte.");
  process.exitCode = 1;
});
