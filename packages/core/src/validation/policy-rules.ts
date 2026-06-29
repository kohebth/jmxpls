import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

export function validatePolicyRules(plan: SemanticPlan): Diagnostic[] {
  return flattenSemanticNodes(plan.root)
    .filter((node) => node.type === "ViewResultsTree" && node.enabled)
    .map((node) => ({
      code: "JMX_VIEW_RESULTS_TREE_ENABLED",
      severity: "warning",
      message: "View Results Tree is enabled and is risky for load/CI execution.",
      nodeId: node.nodeId,
      jmxPath: node.path,
      fixSuggestion: "Disable GUI-heavy listeners before CI or load mode."
    }));
}
