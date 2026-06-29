import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

const GUI_HEAVY_LISTENERS = new Set(["ViewResultsTree", "ViewResultsFullVisualizer", "TableVisualizer", "GraphVisualizer", "AggregateGraph", "MailerVisualizer"]);

export function validatePolicyRules(plan: SemanticPlan): Diagnostic[] {
  return flattenSemanticNodes(plan.root).flatMap((node) => {
    const diagnostics: Diagnostic[] = [];
    if (GUI_HEAVY_LISTENERS.has(node.type) && node.enabled) {
      diagnostics.push({
        code: "JMX_GUI_LISTENER_ENABLED",
        severity: "warning",
        message: `${node.type} is enabled and is risky for load/CI execution.`,
        nodeId: node.nodeId,
        jmxPath: node.path,
        fixSuggestion: "Disable GUI-heavy listeners before CI or load mode."
      });
    }
    if (node.type === "DebugSampler" && node.enabled) {
      diagnostics.push({
        code: "JMX_DEBUG_SAMPLER_ENABLED",
        severity: "warning",
        message: "Debug Sampler is enabled and can expose variables or slow load runs.",
        nodeId: node.nodeId,
        jmxPath: node.path,
        fixSuggestion: "Disable Debug Sampler before CI or load mode."
      });
    }
    return diagnostics;
  });
}
