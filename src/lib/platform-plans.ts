export type PlatformPlan = "essential" | "plus" | "pro";
export type PlatformFeature = "emails" | "classroom";
const MB = 1024 * 1024,
  GB = 1024 * MB;
export const PLATFORM_PLANS = {
  essential: {
    id: "essential",
    name: "Essencial",
    maxFileBytes: 20 * MB,
    storageBytes: GB,
    emails: false,
    classroom: false,
  },
  plus: {
    id: "plus",
    name: "Plus",
    maxFileBytes: 100 * MB,
    storageBytes: 5 * GB,
    emails: false,
    classroom: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxFileBytes: GB,
    storageBytes: 20 * GB,
    emails: true,
    classroom: true,
  },
} as const;
export function resolvePlatformPlan(value: unknown): PlatformPlan {
  return value === "pro" || value === "studio"
    ? "pro"
    : value === "plus" || value === "professional"
      ? "plus"
      : "essential";
}
export const platformPlan = (value: unknown) => PLATFORM_PLANS[resolvePlatformPlan(value)];
export function hasPlatformFeature(plan: unknown, feature: PlatformFeature) {
  return platformPlan(plan)[feature];
}
