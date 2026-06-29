import type { SemanticNode, SemanticPlan } from "../model/semantic.js";
import { executionFlow } from "../semantic/execution-flow.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";
import { redactFields } from "./redaction.js";
import type { PlanLanguageDocument, PlanLanguageNode, PlanLanguageProjectionOptions } from "./types.js";

export function projectPlanLanguage(plan: SemanticPlan, options: PlanLanguageProjectionOptions = {}): PlanLanguageDocument {
  const mode = options.mode ?? "outline";
  const detail = options.detail ?? "compact";
  const selectedNodes = options.subtreeNodeId ? findSubtree(plan.root, options.subtreeNodeId) : plan.root;

  return {
    format: "jmxpls-plan-language",
    version: 1,
    mode,
    detail,
    name: plan.name,
    nodes: nodesForMode(plan, selectedNodes, options),
    warnings: plan.warnings
  };
}

function nodesForMode(
  plan: SemanticPlan,
  nodes: SemanticNode[],
  options: PlanLanguageProjectionOptions
): PlanLanguageNode[] {
  const mode = options.mode ?? "outline";

  if (mode === "flow") {
    return executionFlow(plan).map((step) => ({
      nodeId: step.nodeId,
      role: step.role,
      type: step.role,
      name: `${"  ".repeat(step.depth)}${step.name}`,
      enabled: step.enabled
    }));
  }

  return nodes.map((node) => projectNode(node, options));
}

function projectNode(node: SemanticNode, options: PlanLanguageProjectionOptions): PlanLanguageNode {
  const mode = options.mode ?? "outline";
  const detail = options.detail ?? "compact";
  const projected: PlanLanguageNode = {
    nodeId: node.nodeId,
    role: node.role,
    type: node.type,
    name: node.name,
    enabled: node.enabled
  };

  if (node.children.length > 0) {
    projected.children = node.children.map((child) => projectNode(child, options));
  }

  if (mode === "semantic" || mode === "full" || detail !== "compact") {
    projected.fields = redactFields(node.fields, options.redaction ?? "standard");
  }

  if (mode === "full" || detail === "raw-linked" || detail === "lossless-references") {
    projected.rawRef = node.rawRef;
  }

  return projected;
}

function findSubtree(nodes: SemanticNode[], nodeId: string): SemanticNode[] {
  for (const node of flattenSemanticNodes(nodes)) {
    if (node.nodeId === nodeId) {
      return [node];
    }
  }

  return [];
}
