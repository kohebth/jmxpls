import type { ResourceRegistry } from "./registry.js";

export function registerDiffResources(registry: ResourceRegistry): void {
  registry.register({
    uriTemplate: "jmxpls://plans/{planId}/diff/xml",
    name: "XML diff",
    description: "Explicit XML diff view for callers that request raw serialization changes."
  });
}
