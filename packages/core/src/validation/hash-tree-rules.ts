import type { JmxDocument } from "../model/canonical.js";
import type { Diagnostic } from "../model/diagnostics.js";

export function validateHashTreeRules(document: JmxDocument): Diagnostic[] {
  return document.diagnostics.filter((diagnostic) => diagnostic.code.startsWith("JMX_HASH_TREE") || diagnostic.code === "JMX_ELEMENT_WITHOUT_HASHTREE");
}
