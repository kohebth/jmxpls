import { planLanguageToJson } from "./json.js";
import { planLanguageToYaml } from "./yaml.js";
import type { PlanLanguageDocument } from "./types.js";

export type PlanLanguageSerializationFormat = "json" | "yaml";

export function serializePlanLanguage(document: PlanLanguageDocument, format: PlanLanguageSerializationFormat = "json"): string {
  return format === "json" ? planLanguageToJson(document) : planLanguageToYaml(document);
}
