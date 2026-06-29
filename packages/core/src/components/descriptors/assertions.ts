import type { ComponentDescriptor } from "../../model/catalog.js";

const assertionTypes = ["ResponseAssertion", "JSONPathAssertion", "JMESPathAssertion", "XPathAssertion", "XPath2Assertion", "XMLAssertion", "XMLSchemaAssertion", "HTMLAssertion", "MD5HexAssertion", "SizeAssertion", "DurationAssertion", "CompareAssertion", "JSR223Assertion", "BeanShellAssertion", "SMIMEAssertion"];

export const assertionDescriptors: ComponentDescriptor[] = assertionTypes.map((type) => ({
  type,
  role: "assertion",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: [{ name: "expected", type: "string" }]
}));
