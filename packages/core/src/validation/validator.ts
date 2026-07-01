import { createBuiltInComponentRegistry } from "../components/built-in.js";
import type { JmxDocument } from "../model/canonical.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticNode, SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";
import { validateComponentRules } from "./component-rules.js";
import { validateHashTreeRules } from "./hash-tree-rules.js";
import { validatePolicyRules } from "./policy-rules.js";
import { validateSecurityRules } from "./security-rules.js";
import { validateSemanticRules } from "./semantic-rules.js";

export type ValidationResult = {
  valid: boolean;
  diagnostics: Diagnostic[];
};

export function validatePlan(document: JmxDocument, semantic: SemanticPlan): ValidationResult {
  const diagnostics = completeValidationDiagnostics([
    ...validateHashTreeRules(document),
    ...validateSemanticRules(semantic),
    ...validateComponentRules(semantic, createBuiltInComponentRegistry()),
    ...validatePolicyRules(semantic),
    ...validateSecurityRules(semantic)
  ], semantic);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error" && diagnostic.severity !== "fatal"),
    diagnostics
  };
}

function completeValidationDiagnostics(diagnostics: Diagnostic[], semantic: SemanticPlan): Diagnostic[] {
  const nodes = flattenSemanticNodes(semantic.root);
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const byPath = new Map(nodes.map((node) => [node.path, node]));

  return diagnostics.map((diagnostic) => completeDiagnostic(diagnostic, byId, byPath));
}

function completeDiagnostic(diagnostic: Diagnostic, byId: Map<string, SemanticNode>, byPath: Map<string, SemanticNode>): Diagnostic {
  const node = diagnostic.nodeId ? byId.get(diagnostic.nodeId) : diagnostic.jmxPath ? byPath.get(diagnostic.jmxPath) : undefined;
  return {
    ...diagnostic,
    nodeId: diagnostic.nodeId ?? node?.nodeId ?? "plan",
    jmxPath: diagnostic.jmxPath ?? node?.path ?? "/",
    fixSuggestion: diagnostic.fixSuggestion ?? defaultFixSuggestion(diagnostic.code)
  };
}

function defaultFixSuggestion(code: string): string {
  if (code.startsWith("JMX_XML")) return "Open the JMX in JMeter or an XML editor, fix the XML syntax, then reopen the plan.";
  if (code.startsWith("JMX_HASH_TREE") || code === "JMX_ELEMENT_WITHOUT_HASHTREE") return "Repair the JMX hashTree pairing so each test element is followed by its child hashTree.";
  return "Inspect the referenced node or plan diagnostics, then apply the smallest semantic or raw patch that resolves this issue.";
}
