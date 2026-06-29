import { EXTRACTOR_TOOL_INPUT_SCHEMAS } from "../input-schemas.js";
import type { ToolRegistry } from "../registry.js";

const EXTRACTOR_TOOLS = ["add_regex_extractor", "add_json_extractor", "add_boundary_extractor", "add_xpath_extractor", "add_css_extractor"];

export function registerExtractorTools(registry: ToolRegistry): void {
  for (const name of EXTRACTOR_TOOLS) {
    registry.register({
      name,
      description: `Typed extractor tool: ${name}`,
      inputSchema: EXTRACTOR_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}
