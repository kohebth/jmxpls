import type { ResourceRegistry } from "./registry.js";

const RUN_RESOURCES = [
  ["jmxpls://runs", "Runs", "Lists in-memory JMeter run records for this server process."],
  ["jmxpls://runs/{runId}", "Run status", "Status, command, logs, and artifacts for a JMeter run."],
  ["jmxpls://runs/{runId}/logs", "Run logs", "Log lines for a JMeter run."],
  ["jmxpls://runs/{runId}/artifacts", "Run artifacts", "Artifact paths produced or planned for a JMeter run."]
] as const;

export function registerRunResources(registry: ResourceRegistry): void {
  for (const [uriTemplate, name, description] of RUN_RESOURCES) {
    registry.register({ uriTemplate, name, description });
  }
}
