import type { ResourceRegistry } from "./registry.js";

export function registerSecurityResources(registry: ResourceRegistry): void {
  registry.register({
    uriTemplate: "jmxpls://audit",
    name: "Audit log",
    description: "In-memory audit log for mutations, saves, and planned runs."
  });
}
