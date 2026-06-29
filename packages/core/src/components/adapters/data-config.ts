import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { dataConfigDescriptors } from "../descriptors/data-config.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const dataConfigAdapters: ComponentAdapter[] = dataConfigDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...dataConfigFields(element)
  })
}));

function dataConfigFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "Arguments":
      return { variables: jsonOrValue(findPropertyValue(element.properties, "Arguments.arguments")) };
    case "CSVDataSet":
      return compactFields({
        filename: findPropertyValue(element.properties, "filename"),
        variableNames: splitCsv(findPropertyValue(element.properties, "variableNames")),
        delimiter: findPropertyValue(element.properties, "delimiter"),
        ignoreFirstLine: booleanOrString(findPropertyValue(element.properties, "ignoreFirstLine")),
        recycle: booleanOrString(findPropertyValue(element.properties, "recycle")),
        stopThread: booleanOrString(findPropertyValue(element.properties, "stopThread")),
        shareMode: findPropertyValue(element.properties, "shareMode")
      });
    case "CounterConfig":
      return compactFields({
        start: numberOrString(findPropertyValue(element.properties, "CounterConfig.start")),
        end: numberOrString(findPropertyValue(element.properties, "CounterConfig.end")),
        increment: numberOrString(findPropertyValue(element.properties, "CounterConfig.incr")),
        variableName: findPropertyValue(element.properties, "CounterConfig.name"),
        format: findPropertyValue(element.properties, "CounterConfig.format")
      });
    case "RandomVariableConfig":
      return compactFields({
        variableName: findPropertyValue(element.properties, "variableName"),
        minimumValue: numberOrString(findPropertyValue(element.properties, "minimumValue")),
        maximumValue: numberOrString(findPropertyValue(element.properties, "maximumValue")),
        outputFormat: findPropertyValue(element.properties, "outputFormat"),
        perThread: booleanOrString(findPropertyValue(element.properties, "perThread"))
      });
    case "JDBCDataSource":
      return compactFields({
        dataSource: findPropertyValue(element.properties, "dataSource"),
        dbUrl: findPropertyValue(element.properties, "dbUrl"),
        driver: findPropertyValue(element.properties, "driver"),
        username: findPropertyValue(element.properties, "username")
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
