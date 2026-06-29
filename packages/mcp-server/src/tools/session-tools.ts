import { ANY_OBJECT_SCHEMA, SESSION_TOOL_INPUT_SCHEMAS } from "./input-schemas.js";
import type { ToolRegistry } from "./registry.js";

const SESSION_TOOLS = [
  "open_plan", "create_plan", "close_plan", "reload_plan", "save_plan", "save_plan_as", "export_plan", "backup_plan",
  "list_open_plans", "summarize_plan", "list_tree", "get_node"
];

export function registerSessionTools(registry: ToolRegistry): void {
  for (const name of SESSION_TOOLS) {
    registry.register({
      name,
      description: `Session tool: ${name}`,
      inputSchema: SESSION_TOOL_INPUT_SCHEMAS[name] ?? ANY_OBJECT_SCHEMA
    });
  }
}
