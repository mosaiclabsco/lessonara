import Link from "next/link";
export function FeatureRequired({feature}:{feature:string}){return <section className="card empty-state"><h1 className="h2">{feature} no plano Pro</h1><p>Este recurso está disponível no plano Pro do Lessonara.</p><Link className="btn mt-5" href="/settings?tab=subscription#subscription">Ver plano da empresa</Link></section>;}
