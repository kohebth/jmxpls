import type { PlanLanguageDocument } from "./types.js";

export function planLanguageToJson(document: PlanLanguageDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function planLanguageFromJson(text: string): PlanLanguageDocument {
  return JSON.parse(text) as PlanLanguageDocument;
}
