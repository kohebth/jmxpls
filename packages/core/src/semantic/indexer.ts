import { createBuiltInComponentRegistry } from "../components/built-in.js";
import type { ComponentAdapter } from "../components/adapter.js";
import type { ComponentRegistry } from "../components/registry.js";
import type { HashTreeNode, JmxDocument, JmxElementNode, JmxPairNode } from "../model/canonical.js";
import type { SemanticIndexes, SemanticNode, SemanticPlan, SemanticRole } from "../model/semantic.js";
import { extractVariableReferences } from "./variables.js";

export function buildSemanticPlan(document: JmxDocument, planId?: string, registry: ComponentRegistry = createBuiltInComponentRegistry()): SemanticPlan {
  const indexes: SemanticIndexes = { byId: {}, byRole: {}, byName: {}, byType: {}, variables: {} };
  const root = document.root?.hashTree ? indexHashTree(document.root.hashTree, indexes, registry) : [];
  const firstPlan = root.find((node) => node.role === "testPlan");
  const plan: SemanticPlan = {
    name: firstPlan?.name ?? "JMeter Test Plan",
    root,
    indexes,
    warnings: document.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
  };

  if (planId) {
    plan.planId = planId;
  }

  return plan;
}

function indexHashTree(hashTree: HashTreeNode, indexes: SemanticIndexes, registry: ComponentRegistry, parentNodeId?: string): SemanticNode[] {
  return hashTree.pairs.map((pair) => semanticNodeFromPair(pair, indexes, registry, parentNodeId));
}

function semanticNodeFromPair(pair: JmxPairNode, indexes: SemanticIndexes, registry: ComponentRegistry, parentNodeId?: string): SemanticNode {
  const element = pair.element;
  const adapter = registry.lookup(componentLookupInput(element));
  const role = adapter?.descriptor.role ?? inferRole(element);
  const type = adapter?.descriptor.type ?? element.testClass ?? element.tagName;
  const fields = fieldsFromElement(element, adapter);
  const node: SemanticNode = {
    nodeId: pair.nodeId,
    path: pair.path,
    role,
    type,
    name: element.testName ?? element.tagName,
    enabled: element.enabled ?? true,
    fields,
    children: indexHashTree(pair.children, indexes, registry, pair.nodeId),
    rawRef: `jmxpls://raw/${pair.nodeId}`
  };

  if (parentNodeId) {
    node.parentNodeId = parentNodeId;
  }

  addIndex(indexes.byId, pair.nodeId, pair.path);
  addListIndex(indexes.byRole, role, pair.nodeId);
  addListIndex(indexes.byName, node.name, pair.nodeId);
  addListIndex(indexes.byType, node.type, pair.nodeId);

  for (const variable of extractVariableReferences(JSON.stringify(fields))) {
    addListIndex(indexes.variables, variable, pair.nodeId);
  }

  return node;
}

function componentLookupInput(element: JmxElementNode): { xmlTag?: string; testClass?: string; guiClass?: string } {
  const input: { xmlTag?: string; testClass?: string; guiClass?: string } = { xmlTag: element.tagName };
  if (element.testClass) {
    input.testClass = element.testClass;
  }
  if (element.guiClass) {
    input.guiClass = element.guiClass;
  }
  return input;
}

function fieldsFromElement(element: JmxElementNode, adapter?: ComponentAdapter): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    tagName: element.tagName,
    properties: element.properties.map((property) => ({
      name: property.name,
      tagName: property.tagName,
      value: property.value
    })),
    ...(adapter?.toFields(element) ?? {})
  };

  if (element.guiClass) {
    fields.guiClass = element.guiClass;
  }
  if (element.testClass) {
    fields.testClass = element.testClass;
  }

  return fields;
}

export function inferRole(element: JmxElementNode): SemanticRole {
  const type = element.testClass ?? element.tagName;

  if (type === "TestPlan") {
    return "testPlan";
  }
  if (type.includes("ThreadGroup")) {
    return "threadGroup";
  }
  if (type.includes("Controller") || type.endsWith("Control")) {
    return "controller";
  }
  if (type.includes("Sampler")) {
    return "sampler";
  }
  if (type.includes("Assertion")) {
    return "assertion";
  }
  if (type.includes("Timer")) {
    return "timer";
  }
  if (type.includes("Extractor") || type.includes("PostProcessor")) {
    return "extractor";
  }
  if (type.includes("PreProcessor")) {
    return "processor";
  }
  if (type.includes("Listener") || type.includes("Collector") || type.includes("Visualizer")) {
    return "listener";
  }
  if (type.includes("Config") || type.includes("Manager") || type === "Arguments") {
    return "config";
  }

  return "unknown";
}

function addIndex(index: Record<string, string>, key: string, value: string): void {
  index[key] = value;
}

function addListIndex(index: Record<string, string[]>, key: string, value: string): void {
  const current = index[key] ?? [];
  current.push(value);
  index[key] = current;
}
