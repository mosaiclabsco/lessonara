import { Suspense } from "react";
import { EmailUnsubscribe } from "@/components/email-unsubscribe";
async function Content({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="calls-login">
      <EmailUnsubscribe token={token ?? ""} />
    </main>
  );
}
export default function Page(props: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
