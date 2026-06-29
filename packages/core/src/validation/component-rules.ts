import type { ComponentRegistry } from "../components/registry.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

export function validateComponentRules(plan: SemanticPlan, registry: ComponentRegistry): Diagnostic[] {
  return flattenSemanticNodes(plan.root)
    .filter((node) => !registry.lookup({ type: node.type }))
    .map((node) => ({
      code: "JMX_UNKNOWN_COMPONENT",
      severity: "info",
      message: `No typed descriptor found for ${node.type}; raw preservation will be used.`,
      nodeId: node.nodeId,
      jmxPath: node.path
    }));
}
