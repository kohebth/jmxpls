import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { listenerDescriptors } from "../descriptors/listeners.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const listenerAdapters: ComponentAdapter[] = listenerDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...listenerFields(element)
  })
}));

function listenerFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "ResultCollector":
    case "SimpleDataWriter":
    case "SummaryReport":
    case "AggregateReport":
      return compactFields({
        filename: findPropertyValue(element.properties, "filename"),
        errorLogging: booleanOrString(findPropertyValue(element.properties, "ResultCollector.error_logging")),
        saveConfig: jsonOrValue(findPropertyValue(element.properties, "saveConfig"))
      });
    case "BackendListener":
      return compactFields({
        classname: findPropertyValue(element.properties, "classname"),
        queueSize: numberOrString(findPropertyValue(element.properties, "queueSize")),
        arguments: jsonOrValue(findPropertyValue(element.properties, "arguments"))
      });
    default:
      return {};
  }
}

function findPropertyValue(properties: JmxPropertyNode[], name: string): string | undefined {
  for (const property of properties) {
    if (property.name === name) {
      return property.value;
    }
    const childValue = findPropertyValue(property.children, name);
    if (childValue !== undefined) {
      return childValue;
    }
  }
  return undefined;
}

function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function jsonOrValue(value: string | undefined): unknown {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function numberOrString(value: string | undefined): string | number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function booleanOrString(value: string | undefined): string | boolean | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}
