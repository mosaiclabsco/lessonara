"use client";
import { createContext, useContext, type ReactNode } from "react";
import { platformPlan, type PlatformPlan } from "@/lib/platform-plans";
const PlanContext = createContext<PlatformPlan>("essential");
export function PlatformPlanProvider({
  plan,
  children,
}: {
  plan: PlatformPlan;
  children: ReactNode;
}) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}
export const usePlatformPlan = () => platformPlan(useContext(PlanContext));
