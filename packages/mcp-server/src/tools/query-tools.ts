import { QUERY_TOOL_INPUT_SCHEMAS } from "./input-schemas.js";
import type { ToolRegistry } from "./registry.js";

const QUERY_TOOLS = [
  "find_nodes",
  "find_by_variable",
  "find_by_request",
  "find_disabled_nodes",
  "explain_execution_flow"
];

export function registerQueryTools(registry: ToolRegistry): void {
  for (const name of QUERY_TOOLS) {
    registry.register({
      name,
      description: `Query tool: ${name}`,
      inputSchema: QUERY_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}
