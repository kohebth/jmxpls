import { ANY_OBJECT_SCHEMA, PLAN_LANGUAGE_TOOL_INPUT_SCHEMAS } from "./input-schemas.js";
import type { ToolRegistry } from "./registry.js";

const PLAN_LANGUAGE_TOOLS = [
  "get_plan_language",
  "export_plan_language",
  "import_plan_language",
  "apply_plan_language",
  "validate_plan_language",
  "roundtrip_plan_language",
  "explain_plan_language",
  "compare_plan_language"
];

export function registerPlanLanguageTools(registry: ToolRegistry): void {
  for (const name of PLAN_LANGUAGE_TOOLS) {
    registry.register({
      name,
      description: `Plan Language tool: ${name}`,
      inputSchema: PLAN_LANGUAGE_TOOL_INPUT_SCHEMAS[name] ?? ANY_OBJECT_SCHEMA
    });
  }
}
