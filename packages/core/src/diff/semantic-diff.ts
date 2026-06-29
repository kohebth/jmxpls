import type { NodeAddedChange, NodeMovedChange, SemanticDiff, SemanticDiffChange } from "../model/diff.js";
import type { SemanticNode, SemanticPlan } from "../model/semantic.js";

export function diffSemanticPlans(before: SemanticPlan, after: SemanticPlan, revisionBefore = 0, revisionAfter = 1): SemanticDiff {
  const beforeNodes = indexNodes(before.root);
  const afterNodes = indexNodes(after.root);
  const changes: SemanticDiffChange[] = [];

  for (const [nodeId, beforeEntry] of beforeNodes) {
    const afterEntry = afterNodes.get(nodeId);
    if (!afterEntry) {
      changes.push({
        kind: "node.deleted",
        nodeId,
        nodeType: beforeEntry.node.type,
        name: beforeEntry.node.name,
        jmxPath: beforeEntry.node.path
      });
      continue;
    }

    if (beforeEntry.parentNodeId !== afterEntry.parentNodeId || beforeEntry.index !== afterEntry.index) {
      changes.push(nodeMovedChange(nodeId, beforeEntry, afterEntry));
    }

    changes.push(...fieldChanges(beforeEntry.node, afterEntry.node));
  }

  for (const [nodeId, afterEntry] of afterNodes) {
    if (!beforeNodes.has(nodeId)) {
      changes.push(nodeAddedChange(nodeId, afterEntry.node));
    }
  }

  return { revisionBefore, revisionAfter, changes };
}

type IndexedNode = {
  node: SemanticNode;
  parentNodeId?: string;
  index: number;
};

function indexNodes(nodes: SemanticNode[], parentNodeId?: string, target = new Map<string, IndexedNode>()): Map<string, IndexedNode> {
  nodes.forEach((node, index) => {
    const entry: IndexedNode = { node, index };
    if (parentNodeId) {
      entry.parentNodeId = parentNodeId;
    }
    target.set(node.nodeId, entry);
    indexNodes(node.children, node.nodeId, target);
  });
  return target;
}

function nodeMovedChange(nodeId: string, before: IndexedNode, after: IndexedNode): NodeMovedChange {
  const change: NodeMovedChange = {
    kind: "node.moved",
    nodeId,
    fromIndex: before.index,
    toIndex: after.index,
    jmxPath: before.node.path
  };

  if (before.parentNodeId) {
    change.fromParentNodeId = before.parentNodeId;
  }
  if (after.parentNodeId) {
    change.toParentNodeId = after.parentNodeId;
  }

  return change;
}

function nodeAddedChange(nodeId: string, node: SemanticNode): NodeAddedChange {
  const change: NodeAddedChange = {
    kind: "node.added",
    nodeId,
    nodeType: node.type,
    name: node.name,
    jmxPath: node.path
  };

  if (node.parentNodeId) {
    change.parentNodeId = node.parentNodeId;
  }

  return change;
}

function fieldChanges(before: SemanticNode, after: SemanticNode): SemanticDiffChange[] {
  const changes: SemanticDiffChange[] = [];

  if (before.name !== after.name) {
    changes.push({ kind: "node.renamed", nodeId: before.nodeId, before: before.name, after: after.name, jmxPath: before.path });
  }

  if (before.enabled !== after.enabled) {
    changes.push({ kind: "node.enabledChanged", nodeId: before.nodeId, before: before.enabled, after: after.enabled, jmxPath: before.path });
  }

  for (const key of new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])) {
    if (JSON.stringify(before.fields[key]) !== JSON.stringify(after.fields[key])) {
      changes.push({ kind: "field.updated", nodeId: before.nodeId, fieldPath: key, before: before.fields[key], after: after.fields[key], jmxPath: before.path });
    }
  }

  return changes;
}
