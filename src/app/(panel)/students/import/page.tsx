import { Suspense } from "react";
import Link from "next/link";
import PanelLoading from "../../loading";
import { requireUser } from "@/lib/supabase/server";
import { platformPlan } from "@/lib/platform-plans";
import { loadOnboarding } from "@/lib/onboarding";
import { SetupNotice } from "@/components/onboarding-guide";
import { ImportWizard } from "@/components/import-wizard";
import type { ImportBatch } from "@/lib/import-rules";
import { Icon } from "@/components/icon";
export default function Page({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
async function Content({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { supabase, userId, teacher } = await requireUser();
  const plan = platformPlan(teacher.platform_plan);
  const state = await loadOnboarding();
  if (!plan.imports)
    return (
      <main className="form-page">
        <section className="card space-y-4">
          <h1 className="h2">Importar dados</h1>
          <p>
            A importação guiada e a ajuda da equipe estão disponíveis no Plus e Pro. Você pode
            continuar cadastrando alunos manualmente no Essencial.
          </p>
          <Link className="btn-ghost" href="/settings?tab=subscription">
            <Icon name="book" className="h-4 w-4" />
            Ver planos
          </Link>
        </section>
      </main>
    );
  if (!state.ready) return <SetupNotice />;
  const result = await supabase
    .from("student_imports")
    .select("*")
    .eq("teacher_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ImportBatch[]>();
  if (result.error) throw new Error("Não foi possível carregar seus pedidos.");
  const { batch } = await searchParams;
  const batches = result.data ?? [];
  if (batch && /^[a-f0-9-]{36}$/i.test(batch) && !batches.some((b) => b.id === batch)) {
    const selected = await supabase
      .from("student_imports")
      .select("*")
      .eq("id", batch)
      .eq("teacher_id", userId)
      .maybeSingle<ImportBatch>();
    if (selected.error) throw new Error("Não foi possível abrir o pedido.");
    if (selected.data) batches.push(selected.data);
  }

  return (
    <main className="form-page space-y-6">
      <div className="page-heading">
        <div>
          <h1>Importar alunos</h1>
          <p className="page-description">
            Traga alunos, agendas e saldos de abertura com revisão.
          </p>
        </div>
        <Link className="btn-ghost" href="/students">
          <Icon name="back" className="h-4 w-4" />
          Voltar aos alunos
        </Link>
      </div>
      <ImportWizard batches={batches} selected={batch} />
    </main>
  );
}
