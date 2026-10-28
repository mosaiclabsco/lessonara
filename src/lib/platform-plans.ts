// Links curtos e convites são autenticação básica em todos os planos; a URL nunca autoriza acesso.
// Histórico retroativo, correções e pacotes: todos os planos; suporte só por operador verificado, sem ampliar o plano efetivo.
// Convites e definição de senha são autenticação básica em todos os planos.
// A criação/reemissão pertence exclusivamente ao admin; não é a feature comercial emails.
export type PlatformPlan = "essential" | "plus" | "pro";
export type PlatformFeature =
  "emails" | "classroom" | "imports" | "google" | "exports" | "lessonReminders";
const MB = 1024 * 1024,
  GB = 1024 * MB;
export const PLATFORM_PLANS = {
  essential: {
    id: "essential",
    name: "Essencial",
    maxFileBytes: 20 * MB,
    storageBytes: GB,
    imports: false,
    emails: false,
    classroom: false,
    google: false,
    exports: false,
    lessonReminders: false,
  },
  plus: {
    id: "plus",
    name: "Plus",
    maxFileBytes: 50 * MB,
    storageBytes: 5 * GB,
    imports: true,
    emails: true,
    classroom: false,
    google: true,
    exports: true,
    lessonReminders: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxFileBytes: 100 * MB,
    storageBytes: 10 * GB,
    imports: true,
    emails: true,
    classroom: true,
    google: true,
    exports: true,
    lessonReminders: true,
  },
} as const;
export function resolvePlatformPlan(value: unknown): PlatformPlan {
  return value === "pro" || value === "studio"
    ? "pro"
    : value === "plus" || value === "professional"
      ? "plus"
      : "essential";
}
// Current Supabase Free project has a fixed 50 MB global upload ceiling.
export const PROVIDER_MAX_FILE_BYTES = 50 * MB;
export function platformPlan(value: unknown) {
  const plan = PLATFORM_PLANS[resolvePlatformPlan(value)];
  return { ...plan, maxFileBytes: Math.min(plan.maxFileBytes, PROVIDER_MAX_FILE_BYTES) };
}
export function hasPlatformFeature(plan: unknown, feature: PlatformFeature) {
  return platformPlan(plan)[feature];
}
