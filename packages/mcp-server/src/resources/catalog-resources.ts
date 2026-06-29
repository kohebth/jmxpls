import type { ResourceRegistry } from "./registry.js";

const CATALOG_RESOURCES = [
  ["jmxpls://catalog", "Component catalog", "Merged built-in and dynamic JMeter component catalog."],
  ["jmxpls://catalog/summary", "Component catalog summary", "Component counts and role distribution for the active catalog."],
  ["jmxpls://catalog/types", "Component types", "Compact list of component types in the active catalog."],
  ["jmxpls://catalog/types/{type}", "Component schema", "Descriptor schema for one component type."]
] as const;

export function registerCatalogResources(registry: ResourceRegistry): void {
  for (const [uriTemplate, name, description] of CATALOG_RESOURCES) {
    registry.register({ uriTemplate, name, description });
  }
}
