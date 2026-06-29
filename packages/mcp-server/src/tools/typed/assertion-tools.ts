import { ASSERTION_TOOL_INPUT_SCHEMAS } from "../input-schemas.js";
import type { ToolRegistry } from "../registry.js";

const ASSERTION_TOOLS = ["add_response_assertion", "add_json_assertion", "add_xpath_assertion", "add_duration_assertion", "add_size_assertion", "add_jsr223_assertion"];

export function registerAssertionTools(registry: ToolRegistry): void {
  for (const name of ASSERTION_TOOLS) {
    registry.register({
      name,
      description: `Typed assertion tool: ${name}`,
      inputSchema: ASSERTION_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}
