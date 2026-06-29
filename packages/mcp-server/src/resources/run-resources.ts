import type { ResourceRegistry } from "./registry.js";

export function registerRunResources(registry: ResourceRegistry): void {
  registry.register({
    uriTemplate: "jmxpls://runs/{runId}",
    name: "Run status",
    description: "Status, logs, and artifacts for a JMeter run."
  });
}
