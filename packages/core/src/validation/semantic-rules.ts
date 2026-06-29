import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

export function validateSemanticRules(plan: SemanticPlan): Diagnostic[] {
  const nodes = flattenSemanticNodes(plan.root);
  const hasThreadGroup = nodes.some((node) => node.role === "threadGroup");

  return hasThreadGroup || nodes.length === 0 ? [] : [{
    code: "JMX_NO_THREAD_GROUP",
    severity: "warning",
    message: "Plan has no Thread Group.",
    fixSuggestion: "Add a Thread Group before adding load-generating samplers."
  }];
}
