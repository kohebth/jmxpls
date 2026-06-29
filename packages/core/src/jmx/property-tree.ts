import type { JmxPropertyNode } from "../model/canonical.js";
import type { XmlElementNode } from "../xml/xml-types.js";

export function parsePropertyTree(element: XmlElementNode): JmxPropertyNode[] {
  return element.children
    .filter((child): child is XmlElementNode => child.kind === "element" && isPropertyElement(child.name))
    .map(parsePropertyNode);
}

export function parsePropertyNode(element: XmlElementNode): JmxPropertyNode {
  const text = element.children
    .filter((child) => child.kind === "text" || child.kind === "cdata")
    .map((child) => child.text)
    .join("")
    .trim();
  const property: JmxPropertyNode = {
    tagName: element.name,
    children: element.children
      .filter((child): child is XmlElementNode => child.kind === "element")
      .map(parsePropertyNode),
    raw: element
  };

  if (element.attributes.name) {
    property.name = element.attributes.name;
  }

  if (text.length > 0) {
    property.value = text;
  }

  return property;
}

export function isPropertyElement(tagName: string): boolean {
  return tagName.endsWith("Prop") || tagName === "elementProp" || tagName === "collectionProp";
}
