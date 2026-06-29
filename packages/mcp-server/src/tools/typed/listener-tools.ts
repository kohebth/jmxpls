import type { JsonSchema } from "../input-schemas.js";
import type { ToolRegistry } from "../registry.js";

const NON_EMPTY_STRING = { type: "string", minLength: 1 };
const BOOLEAN = { type: "boolean" };
const INTEGER = { type: "integer" };
const NUMBER = { type: "number" };
const OBJECT = { type: "object", additionalProperties: true };
const STRING_OR_NUMBER = { oneOf: [NON_EMPTY_STRING, NUMBER] };
const PARENT_ONE_OF = { anyOf: [{ required: ["parentNodeId"] }, { required: ["parentId"] }] };

const BASE = { planId: NON_EMPTY_STRING, parentNodeId: NON_EMPTY_STRING, parentId: NON_EMPTY_STRING, name: NON_EMPTY_STRING, enabled: BOOLEAN, index: INTEGER, dryRun: BOOLEAN, validate: BOOLEAN };

const LISTENER_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_simple_data_writer: objectSchema({ ...BASE, filename: NON_EMPTY_STRING, saveConfig: OBJECT }, ["planId", "filename"], PARENT_ONE_OF),
  add_summary_report: objectSchema({ ...BASE, filename: NON_EMPTY_STRING, saveConfig: OBJECT }, ["planId"], PARENT_ONE_OF),
  add_aggregate_report: objectSchema({ ...BASE, filename: NON_EMPTY_STRING, saveConfig: OBJECT }, ["planId"], PARENT_ONE_OF),
  add_backend_listener: objectSchema({ ...BASE, classname: NON_EMPTY_STRING, queueSize: STRING_OR_NUMBER, arguments: OBJECT }, ["planId", "classname"], PARENT_ONE_OF),
  disable_gui_only_listeners: objectSchema({ planId: NON_EMPTY_STRING, dryRun: BOOLEAN, validate: BOOLEAN }, ["planId"])
};

const LISTENER_TOOLS = ["add_simple_data_writer", "add_summary_report", "add_aggregate_report", "add_backend_listener", "disable_gui_only_listeners"];

export function registerListenerTools(registry: ToolRegistry): void {
  for (const name of LISTENER_TOOLS) {
    registry.register({
      name,
      description: `Typed listener tool: ${name}`,
      inputSchema: LISTENER_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}
