import type { SemanticNode, SemanticPlan } from "../model/semantic.js";

export type ExecutionFlowStep = {
  nodeId: string;
  depth: number;
  role: SemanticNode["role"];
  name: string;
  enabled: boolean;
};

export function executionFlow(plan: SemanticPlan): ExecutionFlowStep[] {
  return plan.root.flatMap((node) => nodeFlow(node, 0));
}

function nodeFlow(node: SemanticNode, depth: number): ExecutionFlowStep[] {
  const current: ExecutionFlowStep = {
    nodeId: node.nodeId,
    depth,
    role: node.role,
    name: node.name,
    enabled: node.enabled
  };

  return [current, ...node.children.flatMap((child) => nodeFlow(child, depth + 1))];
}
