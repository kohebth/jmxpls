import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

const SECRET_FIELD_PATTERN = /(password|secret|token|apikey|apiKey|authorization|bearer)/i;
const SECRET_VALUE_PATTERN = /(bearer\s+[a-z0-9._~+/=-]{12,}|basic\s+[a-z0-9+/=-]{12,}|[a-z0-9._%+-]+:[^\s@]{6,}@)/i;

export function validateSecurityRules(plan: SemanticPlan): Diagnostic[] {
  return flattenSemanticNodes(plan.root).flatMap((node) =>
    Object.entries(node.fields).flatMap(([field, value]) => {
      const diagnostics: Diagnostic[] = [];
      if (SECRET_FIELD_PATTERN.test(field)) {
        diagnostics.push({
          code: "JMX_SECRET_LIKE_FIELD",
          severity: "warning",
          message: `Field ${field} may contain a secret and should be redacted in summaries.`,
          nodeId: node.nodeId,
          jmxPath: node.path,
          fixSuggestion: "Use variables or external secret injection instead of storing secrets in the plan."
        });
      }
      if (containsSecretLikeValue(value)) {
        diagnostics.push({
          code: "JMX_SECRET_LIKE_VALUE",
          severity: "warning",
          message: `Field ${field} contains a value that resembles an inline secret.`,
          nodeId: node.nodeId,
          jmxPath: node.path,
          fixSuggestion: "Move inline credentials to variables or a CI secret store."
        });
      }
      return diagnostics;
    })
  );
}

function containsSecretLikeValue(value: unknown): boolean {
  if (typeof value === "string") {
    return SECRET_VALUE_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsSecretLikeValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(containsSecretLikeValue);
  }
  return false;
}
