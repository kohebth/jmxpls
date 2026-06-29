import type { ResourceRegistry } from "./registry.js";

export function registerCatalogResources(registry: ResourceRegistry): void {
  registry.register({
    uriTemplate: "jmxpls://catalog",
    name: "Component catalog",
    description: "Merged built-in and dynamic JMeter component catalog."
  });
}
