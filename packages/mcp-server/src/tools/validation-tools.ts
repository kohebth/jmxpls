import type { JsonSchema } from "./input-schemas.js";
import type { ToolRegistry } from "./registry.js";

const NON_EMPTY_STRING = { type: "string", minLength: 1 };
const BOOLEAN = { type: "boolean" };
const VALIDATION_MODE = { type: "string", enum: ["load", "loadSave", "loadSaveReload"] };
const PLAN_OR_PATH = { anyOf: [{ required: ["planId"] }, { required: ["path"] }, { required: ["planPath"] }, { required: ["jmxPath"] }] };

const VALIDATION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  validate_plan: objectSchema({ planId: NON_EMPTY_STRING }, ["planId"]),
  validate_tree: objectSchema({ planId: NON_EMPTY_STRING }, ["planId"]),
  validate_hash_tree: objectSchema({ planId: NON_EMPTY_STRING }, ["planId"]),
  validate_component_schema: objectSchema({ planId: NON_EMPTY_STRING }, ["planId"]),
  validate_variables: objectSchema({ planId: NON_EMPTY_STRING }, ["planId"]),
  validate_files: objectSchema({ planId: NON_EMPTY_STRING }, ["planId"]),
  validate_with_jmeter: objectSchema({ planId: NON_EMPTY_STRING, path: NON_EMPTY_STRING, planPath: NON_EMPTY_STRING, jmxPath: NON_EMPTY_STRING, mode: VALIDATION_MODE, strict: BOOLEAN }, [], PLAN_OR_PATH),
  roundtrip_validate: objectSchema({ planId: NON_EMPTY_STRING, path: NON_EMPTY_STRING, planPath: NON_EMPTY_STRING, jmxPath: NON_EMPTY_STRING, strict: BOOLEAN }, [], PLAN_OR_PATH)
};

const VALIDATION_TOOLS = ["validate_plan", "validate_tree", "validate_hash_tree", "validate_component_schema", "validate_variables", "validate_files", "validate_with_jmeter", "roundtrip_validate"];

export function registerValidationTools(registry: ToolRegistry): void {
  for (const name of VALIDATION_TOOLS) {
    registry.register({
      name,
      description: `Validation tool: ${name}`,
      inputSchema: VALIDATION_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}
