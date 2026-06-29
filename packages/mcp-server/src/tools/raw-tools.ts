import type { ToolRegistry } from "./registry.js";

const RAW_TOOLS = ["get_raw_element", "get_raw_properties", "add_raw_element", "update_raw_property", "replace_raw_element", "validate_raw_patch", "generate_raw_template"];

export function registerRawTools(registry: ToolRegistry): void {
  for (const name of RAW_TOOLS) {
    registry.register({ name, description: `Raw full-fidelity JMX tool: ${name}`, inputSchema: { type: "object", additionalProperties: true } });
  }
}
