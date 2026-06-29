import type { ToolRegistry } from "./registry.js";

const CATALOG_TOOLS = ["load_component_catalog", "refresh_component_catalog", "inspect_component_schema", "list_component_types", "get_component_defaults", "export_component_catalog", "import_component_catalog"];

export function registerCatalogTools(registry: ToolRegistry): void {
  for (const name of CATALOG_TOOLS) {
    registry.register({ name, description: `Component catalog tool: ${name}`, inputSchema: { type: "object", additionalProperties: true } });
  }
}
