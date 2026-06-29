import type { SemanticPlan } from "../model/semantic.js";
import { planLanguageFromJson, planLanguageToJson } from "./json.js";
import { projectPlanLanguage } from "./projector.js";
import type { PlanLanguageRoundTripResult } from "./types.js";

export function roundTripPlanLanguage(plan: SemanticPlan): PlanLanguageRoundTripResult {
  const projected = projectPlanLanguage(plan, { mode: "full", detail: "lossless-references" });
  const reparsed = planLanguageFromJson(planLanguageToJson(projected));

  return {
    equivalent: JSON.stringify(projected) === JSON.stringify(reparsed),
    original: plan,
    projected,
    reparsed
  };
}
