import { randomUUID } from "node:crypto";

import type { HashTreeNode, JmxDocument, JmxElementNode, JmxPairNode } from "../model/canonical.js";
import type { SemanticDiff } from "../model/diff.js";
import type { SemanticPatch, SemanticPatchOperation } from "../model/patches.js";
import type { SemanticPlan } from "../model/semantic.js";
import { diffSemanticPlans } from "../diff/semantic-diff.js";
import { buildSemanticPlan } from "../semantic/indexer.js";
import type { XmlElementNode } from "../xml/xml-types.js";

export type CanonicalPatchResult = {
  document: JmxDocument;
  before: SemanticPlan;
  after: SemanticPlan;
  diff: SemanticDiff;
  dryRun: boolean;
};

export function applyCanonicalPatch(document: JmxDocument, patch: SemanticPatch, planId?: string): CanonicalPatchResult {
  const working: JmxDocument = structuredClone(document);
  const before = buildSemanticPlan(document, planId);

  for (const operation of patch.operations) {
    const applied = applyOperation(working, operation);
    if (!applied) {
      throw new Error(`Patch operation ${describeOperation(operation)} failed; no changes were committed.`);
    }
  }

  const after = buildSemanticPlan(working, planId);

  return {
    document: working,
    before,
    after,
    diff: diffSemanticPlans(before, after),
    dryRun: patch.dryRun ?? false
  };
}

function applyOperation(document: JmxDocument, operation: SemanticPatchOperation): boolean {
  if (!document.root?.hashTree) {
    return false;
  }

  switch (operation.op) {
    case "setEnabled":
      return setEnabled(document.root.hashTree, operation.nodeId, operation.enabled);
    case "updateField":
      return updateField(document.root.hashTree, operation.nodeId, operation.fieldPath, operation.value);
    case "deleteNode":
      return deleteNode(document.root.hashTree, operation.nodeId);
    case "addNode":
      return addNode(document.root.hashTree, operation.parentNodeId, operation.nodeType, operation.fields ?? {}, operation.index, operation.nodeId);
    case "cloneNode":
      return cloneNode(document.root.hashTree, operation.nodeId, operation.toParentNodeId, operation.index);
    case "moveNode":
      return moveNode(document.root.hashTree, operation.nodeId, operation.toParentNodeId, operation.index);
  }
}

function setEnabled(tree: HashTreeNode, nodeId: string, enabled: boolean): boolean {
  const pair = findPair(tree, nodeId);
  if (!pair) {
    return false;
  }
  pair.element.enabled = enabled;
  pair.element.raw.attributes.enabled = String(enabled);
  return true;
}

function updateField(tree: HashTreeNode, nodeId: string, fieldPath: string, value: unknown): boolean {
  const pair = findPair(tree, nodeId);
  if (!pair) {
    return false;
  }

  if (fieldPath === "name" || fieldPath === "testName" || fieldPath === "testname") {
    pair.element.testName = safeString(value, pair.element.tagName);
    pair.element.raw.attributes.testname = pair.element.testName;
    return true;
  }

  if (fieldPath.startsWith("attributes.")) {
    const attribute = fieldPath.slice("attributes.".length);
    pair.element.raw.attributes[attribute] = safeString(value, "");
    return true;
  }

  upsertStringProperty(pair.element.raw, fieldPath, safeString(value, ""));
  return true;
}

function deleteNode(tree: HashTreeNode, nodeId: string): boolean {
  const index = tree.pairs.findIndex((pair) => pair.nodeId === nodeId);
  if (index >= 0) {
    const [pair] = tree.pairs.splice(index, 1);
    if (pair) {
      removeRawPair(tree.raw, pair);
    }
    return true;
  }

  return tree.pairs.some((pair) => deleteNode(pair.children, nodeId));
}

function addNode(tree: HashTreeNode, parentNodeId: string, nodeType: string, fields: Record<string, unknown>, index?: number, nodeId: string = randomUUID()): boolean {
  const parent = parentNodeId === "root" ? tree : findPair(tree, parentNodeId)?.children;
  if (!parent || findPair(tree, nodeId) || !isValidInsertIndex(parent, index)) {
    return false;
  }

  const elementRaw = createElement(nodeType, fields);
  const childTree = createHashTree();
  const path = `${parent.path}/${nodeType}[${parent.pairs.length}]`;
  const element: JmxElementNode = {
    kind: "element",
    path,
    tagName: nodeType,
    enabled: elementRaw.attributes.enabled !== "false",
    properties: [],
    raw: elementRaw
  };

  if (elementRaw.attributes.testclass) {
    element.testClass = elementRaw.attributes.testclass;
  }
  if (elementRaw.attributes.guiclass) {
    element.guiClass = elementRaw.attributes.guiclass;
  }
  if (elementRaw.attributes.testname) {
    element.testName = elementRaw.attributes.testname;
  }

  const pair: JmxPairNode = {
    kind: "pair",
    path,
    nodeId,
    element,
    children: {
      kind: "hashTree",
      path: `${path}/hashTree`,
      pairs: [],
      raw: childTree
    }
  };
  const insertAt = index ?? parent.pairs.length;
  parent.pairs.splice(insertAt, 0, pair);
  appendRawPair(parent.raw, pair, insertAt);
  return true;
}

function cloneNode(tree: HashTreeNode, nodeId: string, toParentNodeId: string, index?: number): boolean {
  const source = findPair(tree, nodeId);
  const parent = toParentNodeId === "root" ? tree : findPair(tree, toParentNodeId)?.children;
  if (!source || !parent || !isValidInsertIndex(parent, index)) {
    return false;
  }

  const clone: JmxPairNode = structuredClone(source);
  clone.nodeId = randomUUID();
  clone.element.raw.attributes.testname = `${clone.element.raw.attributes.testname ?? clone.element.tagName} Copy`;
  clone.element.testName = clone.element.raw.attributes.testname;
  const insertAt = index ?? parent.pairs.length;
  parent.pairs.splice(insertAt, 0, clone);
  appendRawPair(parent.raw, clone, insertAt);
  return true;
}

function moveNode(tree: HashTreeNode, nodeId: string, toParentNodeId: string, index?: number): boolean {
  if (nodeId === toParentNodeId) {
    return false;
  }

  const source = findPair(tree, nodeId);
  const parent = toParentNodeId === "root" ? tree : findPair(tree, toParentNodeId)?.children;
  if (!source || !parent || containsPair(source.children, toParentNodeId) || !isValidInsertIndex(parent, index)) {
    return false;
  }

  const removed = removePair(tree, nodeId);
  if (!removed) {
    return false;
  }

  const insertAt = index ?? parent.pairs.length;
  parent.pairs.splice(insertAt, 0, removed);
  appendRawPair(parent.raw, removed, insertAt);
  return true;
}

function findPair(tree: HashTreeNode, nodeId: string): JmxPairNode | undefined {
  for (const pair of tree.pairs) {
    if (pair.nodeId === nodeId) {
      return pair;
    }
    const child = findPair(pair.children, nodeId);
    if (child) {
      return child;
    }
  }
  return undefined;
}

function containsPair(tree: HashTreeNode, nodeId: string): boolean {
  return tree.pairs.some((pair) => pair.nodeId === nodeId || containsPair(pair.children, nodeId));
}

function removePair(tree: HashTreeNode, nodeId: string): JmxPairNode | undefined {
  const index = tree.pairs.findIndex((pair) => pair.nodeId === nodeId);
  if (index >= 0) {
    const [pair] = tree.pairs.splice(index, 1);
    if (pair) {
      removeRawPair(tree.raw, pair);
    }
    return pair;
  }

  for (const pair of tree.pairs) {
    const removed = removePair(pair.children, nodeId);
    if (removed) {
      return removed;
    }
  }

  return undefined;
}

function createElement(nodeType: string, fields: Record<string, unknown>): XmlElementNode {
  const attributes: Record<string, string> = {
    testclass: nodeType,
    testname: safeString(fields.name ?? fields.testName, nodeType),
    enabled: safeString(fields.enabled, "true")
  };

  if (typeof fields.guiClass === "string") {
    attributes.guiclass = fields.guiClass;
  }

  const children = Object.entries(fields)
    .filter(([key]) => !["name", "testName", "enabled", "guiClass"].includes(key))
    .map(([key, value]) => createStringProperty(key, safeString(value, "")));

  return { kind: "element", name: nodeType, attributes, children, selfClosing: children.length === 0 };
}

function createHashTree(): XmlElementNode {
  return { kind: "element", name: "hashTree", attributes: {}, children: [], selfClosing: true };
}

function createStringProperty(name: string, value: string): XmlElementNode {
  return {
    kind: "element",
    name: "stringProp",
    attributes: { name },
    children: [{ kind: "text", text: value }],
    selfClosing: false
  };
}

function upsertStringProperty(element: XmlElementNode, name: string, value: string): void {
  const existing = element.children.find((child): child is XmlElementNode => child.kind === "element" && child.attributes.name === name);
  if (existing) {
    existing.children = [{ kind: "text", text: value }];
    existing.selfClosing = false;
    return;
  }

  element.children.push(createStringProperty(name, value));
  element.selfClosing = false;
}

function appendRawPair(parent: XmlElementNode, pair: JmxPairNode, pairIndex: number): void {
  const elementIndexes = parent.children
    .map((child, index) => child.kind === "element" ? index : -1)
    .filter((index) => index >= 0);
  const rawIndex = elementIndexes[pairIndex * 2] ?? parent.children.length;
  parent.children.splice(rawIndex, 0, pair.element.raw, pair.children.raw);
  parent.selfClosing = false;
}

function removeRawPair(parent: XmlElementNode, pair: JmxPairNode): void {
  parent.children = parent.children.filter((child) => child !== pair.element.raw && child !== pair.children.raw);
  parent.selfClosing = parent.children.length === 0;
}

function isValidInsertIndex(tree: HashTreeNode, index?: number): boolean {
  return index === undefined || (Number.isInteger(index) && index >= 0 && index <= tree.pairs.length);
}

function describeOperation(operation: SemanticPatchOperation): string {
  const target = "nodeId" in operation && operation.nodeId ? ` on ${operation.nodeId}` : "";
  return `${operation.op}${target}`;
}

function safeString(value: unknown, fallback: string): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
