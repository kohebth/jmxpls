import { planLanguageFromJson } from "./json.js";
import type { PlanLanguageParseResult } from "./types.js";

export function parsePlanLanguage(text: string): PlanLanguageParseResult {
  const trimmed = text.trimStart();

  if (trimmed.startsWith("{")) {
    return { document: planLanguageFromJson(text), sourceFormat: "json" };
  }

  throw new Error("YAML Plan Language parsing is not implemented yet; use JSON import for now.");
}
