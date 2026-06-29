import type { SemanticNode, SemanticPlan } from "../model/semantic.js";
import type { SemanticPatchOperation } from "../model/patches.js";

export function findSemanticNode(plan: SemanticPlan, nodeId: string): SemanticNode | undefined {
  return flatten(plan.root).find((node) => node.nodeId === nodeId);
}

export function flatten(nodes: SemanticNode[]): SemanticNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export function applySemanticOperation(plan: SemanticPlan, operation: SemanticPatchOperation): SemanticPlan {
  const clone: SemanticPlan = structuredClone(plan);

  switch (operation.op) {
    case "setEnabled": {
      const node = findSemanticNode(clone, operation.nodeId);
      if (node) {
        node.enabled = operation.enabled;
      }
      return clone;
    }
    case "updateField": {
      const node = findSemanticNode(clone, operation.nodeId);
      if (node) {
        node.fields[operation.fieldPath] = operation.value;
      }
      return clone;
    }
    case "deleteNode":
      clone.root = removeNode(clone.root, operation.nodeId);
      return clone;
    default:
      return clone;
  }
}

function removeNode(nodes: SemanticNode[], nodeId: string): SemanticNode[] {
  return nodes
    .filter((node) => node.nodeId !== nodeId)
    .map((node) => ({ ...node, children: removeNode(node.children, nodeId) }));
}
