import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

const SECRET_PATTERN = /(password|secret|token|apikey|authorization)/i;

export function validateSecurityRules(plan: SemanticPlan): Diagnostic[] {
  return flattenSemanticNodes(plan.root).flatMap((node) =>
    Object.keys(node.fields)
      .filter((field) => SECRET_PATTERN.test(field))
      .map((field) => ({
        code: "JMX_SECRET_LIKE_FIELD",
        severity: "warning",
        message: `Field ${field} may contain a secret and should be redacted in summaries.`,
        nodeId: node.nodeId,
        jmxPath: node.path
      }))
  );
}
