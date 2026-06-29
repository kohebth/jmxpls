import { PROCESSOR_TOOL_INPUT_SCHEMAS } from "../input-schemas.js";
import type { ToolRegistry } from "../registry.js";

const PROCESSOR_TOOLS = ["add_jsr223_preprocessor", "add_jsr223_postprocessor", "add_jdbc_preprocessor", "add_user_parameters", "add_url_rewriting_modifier"];

export function registerProcessorTools(registry: ToolRegistry): void {
  for (const name of PROCESSOR_TOOLS) {
    registry.register({
      name,
      description: `Typed processor tool: ${name}`,
      inputSchema: PROCESSOR_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}
