import { ANY_OBJECT_SCHEMA, VALIDATION_TOOL_INPUT_SCHEMAS } from "./input-schemas.js";
import type { ToolRegistry } from "./registry.js";

const VALIDATION_TOOLS = ["validate_plan", "validate_tree", "validate_hash_tree", "validate_component_schema", "validate_variables", "validate_files", "validate_with_jmeter", "roundtrip_validate"];

export function registerValidationTools(registry: ToolRegistry): void {
  for (const name of VALIDATION_TOOLS) {
    registry.register({
      name,
      description: `Validation tool: ${name}`,
      inputSchema: VALIDATION_TOOL_INPUT_SCHEMAS[name] ?? ANY_OBJECT_SCHEMA
    });
  }
}
