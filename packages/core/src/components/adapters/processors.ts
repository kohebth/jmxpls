import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { processorDescriptors } from "../descriptors/processors.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const processorAdapters: ComponentAdapter[] = processorDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...processorFields(element)
  })
}));

function processorFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "JSR223PreProcessor":
    case "JSR223PostProcessor":
      return jsr223Fields(element);
    case "JDBCPreProcessor":
      return compactFields({
        dataSource: findPropertyValue(element.properties, "dataSource"),
        query: findPropertyValue(element.properties, "query"),
        queryType: findPropertyValue(element.properties, "queryType"),
        parameters: findPropertyValue(element.properties, "queryArguments"),
        variableNames: splitCsv(findPropertyValue(element.properties, "variableNames")),
        resultVariable: findPropertyValue(element.properties, "resultVariable")
      });
    case "UserParameters":
      return compactFields({
        variables: jsonOrValue(findPropertyValue(element.properties, "UserParameters.names")),
        perIteration: booleanOrString(findPropertyValue(element.properties, "UserParameters.per_iteration"))
      });
    case "URLRewritingModifier":
      return compactFields({
        argumentName: findPropertyValue(element.properties, "argument_name"),
        pathExtension: booleanOrString(findPropertyValue(element.properties, "path_extension")),
        encode: booleanOrString(findPropertyValue(element.properties, "encode")),
        cacheValue: booleanOrString(findPropertyValue(element.properties, "cache_value"))
      });
    default:
      return {};
  }
}

function jsr223Fields(element: JmxElementNode): Record<string, unknown> {
  return compactFields({
    language: findPropertyValue(element.properties, "scriptLanguage"),
    script: findPropertyValue(element.properties, "script"),
    filename: findPropertyValue(element.properties, "filename"),
    parameters: findPropertyValue(element.properties, "parameters"),
    cacheKey: findPropertyValue(element.properties, "cacheKey")
  });
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

function splitCsv(value: string | undefined): string[] | undefined {
  return value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined;
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
