import { planLanguageFromJson } from "./json.js";
import { planLanguageFromYaml } from "./yaml.js";
import type { PlanLanguageParseResult } from "./types.js";

export function parsePlanLanguage(text: string): PlanLanguageParseResult {
  const trimmed = text.trimStart();

  if (trimmed.startsWith("{")) {
    return { document: planLanguageFromJson(text), sourceFormat: "json" };
  }

  return { document: planLanguageFromYaml(text), sourceFormat: "yaml" };
}
