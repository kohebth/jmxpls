import type { JmxDocument } from "../model/canonical.js";
import { serializeXmlDocument, type SerializeXmlOptions } from "../xml/serialize-xml.js";

export function serializeJmxDocument(document: JmxDocument, options: SerializeXmlOptions = {}): string {
  return serializeXmlDocument(document.xml, options);
}
