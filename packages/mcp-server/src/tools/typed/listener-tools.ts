import type { ToolRegistry } from "../registry.js";

const LISTENER_TOOLS = ["add_simple_data_writer", "add_summary_report", "add_aggregate_report", "add_backend_listener", "disable_gui_only_listeners"];

export function registerListenerTools(registry: ToolRegistry): void {
  for (const name of LISTENER_TOOLS) {
    registry.register({ name, description: `Typed listener tool: ${name}`, inputSchema: { type: "object", additionalProperties: true } });
  }
}
