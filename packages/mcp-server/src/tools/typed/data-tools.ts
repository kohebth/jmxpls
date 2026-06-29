import type { ToolRegistry } from "../registry.js";

const DATA_TOOLS = ["add_user_variables", "add_csv_data_set", "add_counter", "add_random_variable", "add_jdbc_data_source", "convert_hardcoded_host_to_variable"];

export function registerDataTools(registry: ToolRegistry): void {
  for (const name of DATA_TOOLS) {
    registry.register({
      name,
      description: `Typed data/config JMeter tool: ${name}`,
      inputSchema: { type: "object", additionalProperties: true }
    });
  }
}
