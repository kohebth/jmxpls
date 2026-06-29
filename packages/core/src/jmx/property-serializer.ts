import type { JmxPropertyNode } from "../model/canonical.js";
import { serializeXmlNode } from "../xml/serialize-xml.js";

export function serializePropertyNode(property: JmxPropertyNode): string {
  return serializeXmlNode(property.raw);
}
