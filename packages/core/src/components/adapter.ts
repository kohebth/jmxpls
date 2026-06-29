import type { JmxElementNode } from "../model/canonical.js";
import type { ComponentDescriptor } from "../model/catalog.js";
import type { SemanticNode } from "../model/semantic.js";

export type ComponentAdapter = {
  descriptor: ComponentDescriptor;
  toFields(element: JmxElementNode): Record<string, unknown>;
  applyFields?(node: SemanticNode, fields: Record<string, unknown>): SemanticNode;
};

export function defaultFields(element: JmxElementNode): Record<string, unknown> {
  return Object.fromEntries(element.properties.map((property) => [property.name ?? property.tagName, property.value ?? property.children]));
}
