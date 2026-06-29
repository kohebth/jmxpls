import type { ComponentCatalog, ComponentDescriptor } from "../model/catalog.js";

export function mergeCatalogs(...catalogs: ComponentCatalog[]): ComponentCatalog {
  const byType = new Map<string, ComponentDescriptor>();

  for (const catalog of catalogs) {
    for (const component of catalog.components) {
      byType.set(component.type, component);
    }
  }

  return { version: 1, source: "merged", components: [...byType.values()] };
}
