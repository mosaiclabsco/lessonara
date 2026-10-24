import Link from "next/link";
export function FeatureRequired({ feature }: { feature: string }) {
  const plans = feature === "Emails" ? "nos planos Plus e Pro" : "no plano Pro";
  return (
    <section className="card empty-state">
      <h1 className="h2">
        {feature} {plans}
      </h1>
      <p>Este recurso está disponível {plans} do Lessonara.</p>
      <Link className="btn mt-5" href="/settings?tab=subscription#subscription">
        Ver plano da empresa
      </Link>
    </section>
  );
}
