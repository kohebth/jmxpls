import type { ToolRegistry } from "./registry.js";

const STRING = { type: "string", minLength: 1 };
const OBJECT = { type: "object", additionalProperties: true };

const CATALOG_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  load_component_catalog: objectSchema({}),
  refresh_component_catalog: objectSchema({}),
  inspect_component_schema: objectSchema({ type: STRING }, ["type"]),
  list_component_types: objectSchema({ role: STRING }),
  get_component_defaults: objectSchema({ type: STRING }, ["type"]),
  export_component_catalog: objectSchema({}),
  import_component_catalog: objectSchema({ path: STRING, catalog: OBJECT }, [], { anyOf: [{ required: ["path"] }, { required: ["catalog"] }] })
};

export function registerCatalogTools(registry: ToolRegistry): void {
  for (const [name, inputSchema] of Object.entries(CATALOG_TOOL_SCHEMAS)) {
    registry.register({ name, description: `Component catalog tool: ${name}`, inputSchema });
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}
