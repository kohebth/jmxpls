import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticNode, SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

export function validateSemanticRules(plan: SemanticPlan): Diagnostic[] {
  const nodes = flattenSemanticNodes(plan.root);
  const diagnostics: Diagnostic[] = [];
  const hasThreadGroup = nodes.some((node) => node.role === "threadGroup");

  if (!hasThreadGroup && nodes.length > 0) {
    diagnostics.push({
      code: "JMX_NO_THREAD_GROUP",
      severity: "warning",
      message: "Plan has no Thread Group.",
      fixSuggestion: "Add a Thread Group before adding load-generating samplers."
    });
  }

  diagnostics.push(...enabledThreadGroupsWithoutSamplers(plan.root));
  return diagnostics;
}

function enabledThreadGroupsWithoutSamplers(nodes: SemanticNode[]): Diagnostic[] {
  return flattenSemanticNodes(nodes)
    .filter((node) => node.role === "threadGroup" && node.enabled && !flattenSemanticNodes(node.children).some((child) => child.role === "sampler" && child.enabled))
    .map((node) => ({
      code: "JMX_THREAD_GROUP_HAS_NO_ENABLED_SAMPLER",
      severity: "warning",
      message: `Thread Group ${node.name} has no enabled sampler.`,
      nodeId: node.nodeId,
      jmxPath: node.path,
      fixSuggestion: "Add or enable at least one sampler under this Thread Group."
    }));
}
