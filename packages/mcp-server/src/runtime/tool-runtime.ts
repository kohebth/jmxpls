import {
  executionFlow,
  flattenSemanticNodes,
  parsePlanLanguage,
  projectPlanLanguage,
  roundTripPlanLanguage,
  serializePlanLanguage,
  SessionManager,
  summarizePlan,
  type PlanLanguageMode,
  type SemanticNode,
  type SemanticPatch,
  type SemanticPatchOperation,
  type SemanticRole
} from "@jmxpls/core";

import { validateToolInput } from "./input-validation.js";

export type ToolCallResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export type ToolCallInput = Record<string, unknown>;

type PlanSession = NonNullable<ReturnType<SessionManager["get"]>>;

export class JmxplsRuntime {
  private readonly sessions = new SessionManager();

  async callTool(name: string, input: ToolCallInput = {}): Promise<ToolCallResult> {
    try {
      const validation = validateToolInput(name, input);
      if (!validation.valid) {
        return { success: false, error: `Invalid input for ${name}: ${validation.errors.join("; ")}` };
      }

      switch (name) {
        case "open_plan":
          return await this.openPlan(input);
        case "reload_plan":
          return await this.reloadPlan(input);
        case "close_plan":
          return this.closePlan(input);
        case "list_open_plans":
          return { success: true, data: this.sessions.listOpenPlans() };
        case "summarize_plan":
          return this.withSession(input, (session) => summarizePlan(session.semanticPlan()));
        case "list_tree":
          return this.withSession(input, (session) => session.semanticPlan().root);
        case "get_node":
          return this.getNode(input);
        case "find_nodes":
          return this.findNodes(input);
        case "find_by_variable":
          return this.findByVariable(input);
        case "find_by_request":
          return this.findByRequest(input);
        case "find_disabled_nodes":
          return this.findNodes({ ...input, enabled: false });
        case "explain_execution_flow":
          return this.withSession(input, (session) => executionFlow(session.semanticPlan()));
        case "get_plan_language":
        case "export_plan_language":
          return this.getPlanLanguage(input);
        case "validate_plan_language":
          return this.validatePlanLanguage(input);
        case "roundtrip_plan_language":
          return this.withSession(input, (session) => roundTripPlanLanguage(session.semanticPlan()));
        case "explain_plan_language":
          return this.explainPlanLanguage(input);
        case "compare_plan_language":
          return this.comparePlanLanguage(input);
        case "validate_plan":
          return this.withSession(input, (session) => session.validate());
        case "add_node":
          return this.applySingleOperation(input, addNodeOperation(input));
        case "update_node_field":
          return this.applySingleOperation(input, updateFieldOperation(input));
        case "delete_node":
          return this.applySingleOperation(input, deleteNodeOperation(input));
        case "move_node":
          return this.applySingleOperation(input, moveNodeOperation(input));
        case "clone_node":
          return this.applySingleOperation(input, cloneNodeOperation(input));
        case "enable_node":
          return this.applySingleOperation(input, setEnabledOperation(input, true));
        case "disable_node":
          return this.applySingleOperation(input, setEnabledOperation(input, false));
        case "apply_semantic_patch":
          return this.applySemanticPatch(input);
        case "save_plan":
        case "save_plan_as":
          return await this.savePlan(input);
        default:
          return { success: false, error: `Tool ${name} is registered but has no executable handler yet.` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown tool error" };
    }
  }

  readResource(uri: string): ToolCallResult {
    const match = /^jmxpls:\/\/plans\/([^/]+)(?:\/(.*))?$/.exec(uri);
    if (!match) {
      return { success: false, error: `Unsupported resource URI: ${uri}` };
    }

    const [, planId, suffix = "summary"] = match;
    const session = this.sessions.get(planId ?? "");
    if (!session) {
      return { success: false, error: `Unknown planId: ${planId}` };
    }

    if (suffix === "summary") {
      return { success: true, data: summarizePlan(session.semanticPlan()) };
    }
    if (suffix === "tree") {
      return { success: true, data: session.semanticPlan().root };
    }
    if (suffix === "execution-flow") {
      return { success: true, data: executionFlow(session.semanticPlan()) };
    }
    if (suffix.startsWith("plan-language")) {
      const mode = suffix.split("/")[1] as PlanLanguageMode | undefined;
      return { success: true, data: projectPlanLanguage(session.semanticPlan(), { mode: mode ?? "outline" }) };
    }
    if (suffix === "diagnostics") {
      return { success: true, data: session.diagnostics };
    }
    if (suffix === "diff/semantic") {
      return { success: true, data: session.latestDiff ?? null };
    }

    return { success: false, error: `Unsupported resource suffix: ${suffix}` };
  }

  private async openPlan(input: ToolCallInput): Promise<ToolCallResult> {
    const path = requiredString(input, "path");
    const session = await this.sessions.openPlan(path);
    const semantic = session.semanticPlan();
    return {
      success: true,
      data: {
        ...session.summary(),
        summary: summarizePlan(semantic),
        defaultResource: `jmxpls://plans/${session.planId}/plan-language/outline`
      }
    };
  }

  private async reloadPlan(input: ToolCallInput): Promise<ToolCallResult> {
    const planId = requiredString(input, "planId");
    const existing = this.sessions.get(planId);
    if (!existing) {
      return { success: false, error: `Unknown planId: ${planId}` };
    }
    const sourcePath = existing.sourcePath;
    this.sessions.closePlan(planId);
    return this.openPlan({ path: sourcePath });
  }

  private closePlan(input: ToolCallInput): ToolCallResult {
    const planId = requiredString(input, "planId");
    return { success: this.sessions.closePlan(planId), data: { planId } };
  }

  private getNode(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const nodeId = requiredString(input, "nodeId");
      return semanticNodes(session).find((node) => node.nodeId === nodeId) ?? null;
    });
  }

  private findNodes(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const role = optionalString(input, "role") as SemanticRole | undefined;
      const type = optionalString(input, "type");
      const name = optionalString(input, "name");
      const enabled = typeof input.enabled === "boolean" ? input.enabled : undefined;
      return semanticNodes(session).filter((node) =>
        (role ? node.role === role : true) &&
        (type ? node.type.includes(type) : true) &&
        (name ? node.name.includes(name) : true) &&
        (enabled === undefined ? true : node.enabled === enabled)
      );
    });
  }

  private findByVariable(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const variable = requiredString(input, "variable");
      const plan = session.semanticPlan();
      const ids = new Set(plan.indexes.variables[variable] ?? []);
      return semanticNodes(session).filter((node) => ids.has(node.nodeId));
    });
  }

  private findByRequest(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const method = optionalString(input, "method");
      const pathContains = optionalString(input, "pathContains") ?? optionalString(input, "path");
      const domainContains = optionalString(input, "domainContains") ?? optionalString(input, "domain");
      return semanticNodes(session).filter((node) => {
        if (node.role !== "sampler") {
          return false;
        }
        const searchable = `${node.name}\n${node.type}\n${JSON.stringify(node.fields)}`;
        return (
          (method ? searchable.includes(method) : true) &&
          (pathContains ? searchable.includes(pathContains) : true) &&
          (domainContains ? searchable.includes(domainContains) : true)
        );
      });
    });
  }

  private getPlanLanguage(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const mode = (optionalString(input, "mode") ?? "outline") as PlanLanguageMode;
      const format = optionalString(input, "format") ?? "object";
      const document = projectPlanLanguage(session.semanticPlan(), { mode });
      return format === "json" || format === "yaml" ? serializePlanLanguage(document, format) : document;
    });
  }

  private validatePlanLanguage(input: ToolCallInput): ToolCallResult {
    const text = requiredString(input, "text");
    const parsed = parsePlanLanguage(text);
    return { success: true, data: { valid: parsed.document.format === "jmxpls-plan-language", sourceFormat: parsed.sourceFormat } };
  }

  private explainPlanLanguage(input: ToolCallInput): ToolCallResult {
    const text = optionalString(input, "text");
    if (text) {
      const parsed = parsePlanLanguage(text);
      return { success: true, data: summarizePlanLanguage(parsed.document.nodes) };
    }
    return this.withSession(input, (session) => summarizePlanLanguage(projectPlanLanguage(session.semanticPlan()).nodes));
  }

  private comparePlanLanguage(input: ToolCallInput): ToolCallResult {
    const left = parsePlanLanguage(requiredString(input, "left"));
    const right = parsePlanLanguage(requiredString(input, "right"));
    const leftJson = JSON.stringify(left.document);
    const rightJson = JSON.stringify(right.document);
    return {
      success: true,
      data: {
        equivalent: leftJson === rightJson,
        left: summarizePlanLanguage(left.document.nodes),
        right: summarizePlanLanguage(right.document.nodes)
      }
    };
  }

  private applySingleOperation(input: ToolCallInput, operation: SemanticPatchOperation): ToolCallResult {
    const patch: SemanticPatch = { operations: [operation] };
    if (typeof input.dryRun === "boolean") {
      patch.dryRun = input.dryRun;
    }
    if (typeof input.validate === "boolean") {
      patch.validate = input.validate;
    }
    return this.applySemanticPatch({ ...input, patch });
  }

  private applySemanticPatch(input: ToolCallInput): ToolCallResult {
    const planId = requiredString(input, "planId");
    const patch = semanticPatchFromInput(input);
    const session = this.sessions.get(planId);
    if (!session) {
      return { success: false, error: `Unknown planId: ${planId}` };
    }
    return { success: true, data: session.applyPatch(patch) };
  }

  private async savePlan(input: ToolCallInput): Promise<ToolCallResult> {
    const planId = requiredString(input, "planId");
    const session = this.sessions.get(planId);
    if (!session) {
      return { success: false, error: `Unknown planId: ${planId}` };
    }
    return { success: true, data: await session.save(optionalString(input, "path"), input.backup !== false) };
  }

  private withSession(input: ToolCallInput, fn: (session: PlanSession) => unknown): ToolCallResult {
    const planId = requiredString(input, "planId");
    const session = this.sessions.get(planId);
    if (!session) {
      return { success: false, error: `Unknown planId: ${planId}` };
    }
    return { success: true, data: fn(session) };
  }
}

function semanticNodes(session: PlanSession): SemanticNode[] {
  return flattenSemanticNodes(session.semanticPlan().root);
}

function semanticPatchFromInput(input: ToolCallInput): SemanticPatch {
  const patch = input.patch as SemanticPatch | undefined;
  if (patch && Array.isArray(patch.operations)) {
    return patch;
  }
  if (Array.isArray(input.operations)) {
    const fromOperations: SemanticPatch = { operations: input.operations as SemanticPatchOperation[] };
    if (typeof input.dryRun === "boolean") {
      fromOperations.dryRun = input.dryRun;
    }
    if (typeof input.validate === "boolean") {
      fromOperations.validate = input.validate;
    }
    return fromOperations;
  }
  throw new Error("patch.operations is required");
}

function addNodeOperation(input: ToolCallInput): SemanticPatchOperation {
  const parentNodeId = optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "parentNodeId");
  const nodeType = optionalString(input, "nodeType") ?? optionalString(input, "type") ?? requiredString(input, "nodeType");
  const fields = objectInput(input, "fields");
  const index = optionalNumber(input, "index");

  return {
    op: "addNode",
    parentNodeId,
    nodeType,
    ...(fields ? { fields } : {}),
    ...(index !== undefined ? { index } : {})
  };
}

function updateFieldOperation(input: ToolCallInput): SemanticPatchOperation {
  return {
    op: "updateField",
    nodeId: requiredString(input, "nodeId"),
    fieldPath: optionalString(input, "fieldPath") ?? optionalString(input, "field") ?? requiredString(input, "fieldPath"),
    value: input.value
  };
}

function deleteNodeOperation(input: ToolCallInput): SemanticPatchOperation {
  return { op: "deleteNode", nodeId: requiredString(input, "nodeId") };
}

function moveNodeOperation(input: ToolCallInput): SemanticPatchOperation {
  const toParentNodeId = optionalString(input, "toParentNodeId") ?? optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "toParentNodeId");
  const index = optionalNumber(input, "index");

  return {
    op: "moveNode",
    nodeId: requiredString(input, "nodeId"),
    toParentNodeId,
    ...(index !== undefined ? { index } : {})
  };
}

function cloneNodeOperation(input: ToolCallInput): SemanticPatchOperation {
  const toParentNodeId = optionalString(input, "toParentNodeId") ?? optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "toParentNodeId");
  const index = optionalNumber(input, "index");

  return {
    op: "cloneNode",
    nodeId: requiredString(input, "nodeId"),
    toParentNodeId,
    ...(index !== undefined ? { index } : {})
  };
}

function setEnabledOperation(input: ToolCallInput, enabled: boolean): SemanticPatchOperation {
  return { op: "setEnabled", nodeId: requiredString(input, "nodeId"), enabled };
}

function summarizePlanLanguage(nodes: Array<{ role: string; type: string; enabled: boolean; children?: unknown[] }>): Record<string, unknown> {
  const roles: Record<string, number> = {};
  const types: Record<string, number> = {};
  let disabled = 0;
  let total = 0;

  const visit = (node: { role: string; type: string; enabled: boolean; children?: unknown[] }): void => {
    total += 1;
    roles[node.role] = (roles[node.role] ?? 0) + 1;
    types[node.type] = (types[node.type] ?? 0) + 1;
    if (!node.enabled) {
      disabled += 1;
    }
    for (const child of node.children ?? []) {
      visit(child as { role: string; type: string; enabled: boolean; children?: unknown[] });
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return { totalNodes: total, disabledNodes: disabled, roles, types };
}

function requiredString(input: ToolCallInput, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(input: ToolCallInput, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(input: ToolCallInput, key: string): number | undefined {
  const value = input[key];
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function objectInput(input: ToolCallInput, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
