import type { PlanSummary, SemanticNode, SemanticPlan, ThreadGroupSummary } from "../model/semantic.js";

export function summarizePlan(plan: SemanticPlan): PlanSummary {
  const nodes = flattenSemanticNodes(plan.root);
  const threadGroups = nodes
    .filter((node) => node.role === "threadGroup")
    .map(threadGroupSummary);
  const samplers = nodes
    .filter((node) => node.role === "sampler")
    .map((node) => ({ nodeId: node.nodeId, name: node.name, type: node.type, enabled: node.enabled }));

  return {
    name: plan.name,
    nodeCount: nodes.length,
    threadGroups,
    samplers,
    warnings: plan.warnings
  };
}

export function flattenSemanticNodes(nodes: SemanticNode[]): SemanticNode[] {
  return nodes.flatMap((node) => [node, ...flattenSemanticNodes(node.children)]);
}

function threadGroupSummary(node: SemanticNode): ThreadGroupSummary {
  const summary: ThreadGroupSummary = {
    nodeId: node.nodeId,
    name: node.name,
    enabled: node.enabled
  };

  assignIfPresent(summary, "threads", node.fields.threads);
  assignIfPresent(summary, "rampUpSec", node.fields.rampUpSec);
  assignIfPresent(summary, "loops", node.fields.loops);
  assignIfPresent(summary, "durationSec", node.fields.durationSec);
  return summary;
}

function assignIfPresent(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
