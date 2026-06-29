import type { ResourceRegistry } from "./registry.js";

const PLAN_RESOURCES = [
  ["jmxpls://plans", "Open plans", "Lists currently opened JMeter plans."],
  ["jmxpls://plans/{planId}/summary", "Plan summary", "Compact semantic plan summary."],
  ["jmxpls://plans/{planId}/tree", "Plan tree", "Paginated semantic plan tree."],
  ["jmxpls://plans/{planId}/execution-flow", "Execution flow", "Human-readable execution order."],
  ["jmxpls://plans/{planId}/plan-language", "Plan Language", "Default outline Plan Language projection."],
  ["jmxpls://plans/{planId}/plan-language/outline", "Plan Language outline", "Outline view without raw XML."],
  ["jmxpls://plans/{planId}/plan-language/flow", "Plan Language flow", "Execution flow Plan Language view."],
  ["jmxpls://plans/{planId}/plan-language/semantic", "Plan Language semantic", "Editable semantic Plan Language view."],
  ["jmxpls://plans/{planId}/plan-language/full", "Plan Language full", "Full projection with raw references."],
  ["jmxpls://plans/{planId}/node/{nodeId}", "Plan node", "Compact semantic node view."],
  ["jmxpls://plans/{planId}/node/{nodeId}/children", "Plan node children", "Children for a semantic node."],
  ["jmxpls://plans/{planId}/diagnostics", "Plan diagnostics", "Diagnostics for an opened plan."],
  ["jmxpls://plans/{planId}/diff/semantic", "Semantic diff", "Latest semantic diff for an opened plan."]
] as const;

export function registerPlanResources(registry: ResourceRegistry): void {
  for (const [uriTemplate, name, description] of PLAN_RESOURCES) {
    registry.register({ uriTemplate, name, description });
  }
}
