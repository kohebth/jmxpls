import type { PlanLanguageDocument } from "./types.js";

export function renderPlanLanguage(document: PlanLanguageDocument): string {
  return JSON.stringify(document, null, 2);
}
