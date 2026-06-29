import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { assertionDescriptors } from "../descriptors/assertions.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const assertionAdapters: ComponentAdapter[] = assertionDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...assertionFields(element)
  })
}));

function assertionFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "ResponseAssertion":
      return compactFields({
        field: findPropertyValue(element.properties, "Assertion.test_field"),
        matchType: findPropertyValue(element.properties, "Assertion.test_type"),
        patterns: jsonOrValue(findPropertyValue(element.properties, "Assertion.test_strings")),
        invert: booleanOrString(findPropertyValue(element.properties, "Assertion.invert"))
      });
    case "JSONPathAssertion":
      return compactFields({
        jsonPath: findPropertyValue(element.properties, "JSON_PATH"),
        expectedValue: findPropertyValue(element.properties, "EXPECTED_VALUE"),
        validateJson: booleanOrString(findPropertyValue(element.properties, "JSONVALIDATION")),
        expectNull: booleanOrString(findPropertyValue(element.properties, "EXPECT_NULL")),
        invert: booleanOrString(findPropertyValue(element.properties, "INVERT")),
        regex: booleanOrString(findPropertyValue(element.properties, "ISREGEX"))
      });
    case "XPathAssertion":
    case "XPath2Assertion":
      return compactFields({
        xpath: findPropertyValue(element.properties, "XPath.xpath"),
        validate: booleanOrString(findPropertyValue(element.properties, "XPath.validate")),
        whitespace: booleanOrString(findPropertyValue(element.properties, "XPath.whitespace")),
        tolerant: booleanOrString(findPropertyValue(element.properties, "XPath.tolerant")),
        invert: booleanOrString(findPropertyValue(element.properties, "XPath.negate"))
      });
    case "DurationAssertion":
      return compactFields({ durationMs: numberOrString(findPropertyValue(element.properties, "DurationAssertion.duration")) });
    case "SizeAssertion":
      return compactFields({
        sizeBytes: numberOrString(findPropertyValue(element.properties, "SizeAssertion.size")),
        operator: findPropertyValue(element.properties, "SizeAssertion.operator")
      });
    case "JSR223Assertion":
      return compactFields({
        language: findPropertyValue(element.properties, "scriptLanguage"),
        script: findPropertyValue(element.properties, "script"),
        filename: findPropertyValue(element.properties, "filename"),
        parameters: findPropertyValue(element.properties, "parameters")
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
