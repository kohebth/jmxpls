import { createHash } from "node:crypto";

import type { XmlElementNode } from "../xml/xml-types.js";

export function fingerprintElement(element: XmlElementNode): string {
  const hash = createHash("sha256");
  hash.update(element.name);
  hash.update(JSON.stringify(sortObject(element.attributes)));
  hash.update(JSON.stringify(element.children.map((child) => child.kind === "element" ? fingerprintElement(child) : child)));
  return hash.digest("hex").slice(0, 16);
}

function sortObject(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}
