import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { extractorDescriptors } from "../descriptors/extractors.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const extractorAdapters: ComponentAdapter[] = extractorDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...extractorFields(element)
  })
}));

function extractorFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "RegexExtractor":
      return compactFields({
        variableName: findPropertyValue(element.properties, "RegexExtractor.refname"),
        regex: findPropertyValue(element.properties, "RegexExtractor.regex"),
        template: findPropertyValue(element.properties, "RegexExtractor.template"),
        defaultValue: findPropertyValue(element.properties, "RegexExtractor.default"),
        matchNumber: numberOrString(findPropertyValue(element.properties, "RegexExtractor.match_number")),
        source: findPropertyValue(element.properties, "RegexExtractor.useHeaders")
      });
    case "JSONPostProcessor":
      return compactFields({
        variableName: findPropertyValue(element.properties, "JSONPostProcessor.referenceNames"),
        jsonPath: findPropertyValue(element.properties, "JSONPostProcessor.jsonPathExprs"),
        matchNumber: numberOrString(findPropertyValue(element.properties, "JSONPostProcessor.match_numbers")),
        defaultValue: findPropertyValue(element.properties, "JSONPostProcessor.defaultValues"),
        concat: booleanOrString(findPropertyValue(element.properties, "JSONPostProcessor.compute_concat"))
      });
    case "BoundaryExtractor":
      return compactFields({
        variableName: findPropertyValue(element.properties, "BoundaryExtractor.refname"),
        leftBoundary: findPropertyValue(element.properties, "BoundaryExtractor.lboundary"),
        rightBoundary: findPropertyValue(element.properties, "BoundaryExtractor.rboundary"),
        defaultValue: findPropertyValue(element.properties, "BoundaryExtractor.default"),
        matchNumber: numberOrString(findPropertyValue(element.properties, "BoundaryExtractor.match_number")),
        source: findPropertyValue(element.properties, "BoundaryExtractor.useHeaders")
      });
    case "XPathExtractor":
    case "XPath2Extractor":
      return compactFields({
        variableName: findPropertyValue(element.properties, "XPathExtractor.refname"),
        xpath: findPropertyValue(element.properties, "XPathExtractor.xpathQuery"),
        defaultValue: findPropertyValue(element.properties, "XPathExtractor.default"),
        matchNumber: numberOrString(findPropertyValue(element.properties, "XPathExtractor.matchNumber")),
        fragment: booleanOrString(findPropertyValue(element.properties, "XPathExtractor.fragment")),
        validateXml: booleanOrString(findPropertyValue(element.properties, "XPathExtractor.validate")),
        whitespace: booleanOrString(findPropertyValue(element.properties, "XPathExtractor.whitespace")),
        tolerant: booleanOrString(findPropertyValue(element.properties, "XPathExtractor.tolerant"))
      });
    case "HtmlExtractor":
      return compactFields({
        variableName: findPropertyValue(element.properties, "HtmlExtractor.refname"),
        selector: findPropertyValue(element.properties, "HtmlExtractor.expr"),
        attribute: findPropertyValue(element.properties, "HtmlExtractor.attribute"),
        defaultValue: findPropertyValue(element.properties, "HtmlExtractor.default"),
        matchNumber: numberOrString(findPropertyValue(element.properties, "HtmlExtractor.match_number")),
        implementation: findPropertyValue(element.properties, "HtmlExtractor.extractor_impl")
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
