import { TIMER_TOOL_INPUT_SCHEMAS } from "../input-schemas.js";
import type { ToolRegistry } from "../registry.js";

const TIMER_TOOLS = ["add_constant_timer", "add_random_timer", "add_sync_timer", "add_throughput_timer", "add_jsr223_timer"];

export function registerTimerTools(registry: ToolRegistry): void {
  for (const name of TIMER_TOOLS) {
    registry.register({
      name,
      description: `Typed timer tool: ${name}`,
      inputSchema: TIMER_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}
