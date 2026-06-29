import { createBuiltInComponentRegistry } from "../components/built-in.js";
import type { JmxDocument } from "../model/canonical.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
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
  const diagnostics = [
    ...validateHashTreeRules(document),
    ...validateSemanticRules(semantic),
    ...validateComponentRules(semantic, createBuiltInComponentRegistry()),
    ...validatePolicyRules(semantic),
    ...validateSecurityRules(semantic)
  ];

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error" && diagnostic.severity !== "fatal"),
    diagnostics
  };
}
