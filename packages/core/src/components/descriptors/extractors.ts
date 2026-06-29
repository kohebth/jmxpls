import type { ComponentDescriptor } from "../../model/catalog.js";

const extractorTypes = ["RegexExtractor", "JSONPostProcessor", "JMESPathExtractor", "BoundaryExtractor", "XPathExtractor", "XPath2Extractor", "HtmlExtractor"];

export const extractorDescriptors: ComponentDescriptor[] = extractorTypes.map((type) => ({
  type,
  role: "extractor",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: [{ name: "variableName", type: "string" }]
}));
