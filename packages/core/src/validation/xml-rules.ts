import type { Diagnostic } from "../model/diagnostics.js";
import type { XmlDocument } from "../xml/xml-types.js";

export function validateXmlRules(document: XmlDocument): Diagnostic[] {
  return document.diagnostics;
}
