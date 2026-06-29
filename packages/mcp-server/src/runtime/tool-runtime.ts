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

export type ToolCallResult = { success: boolean; data?: unknown; error?: string };
export type ToolCallInput = Record<string, unknown>;
type PlanSession = NonNullable<ReturnType<SessionManager["get"]>>;

export class JmxplsRuntime {
  private readonly sessions = new SessionManager();

  async callTool(name: string, input: ToolCallInput = {}): Promise<ToolCallResult> {
    try {
      const validation = validateToolInput(name, input);
      if (!validation.valid) return { success: false, error: `Invalid input for ${name}: ${validation.errors.join("; ")}` };
      switch (name) {
        case "open_plan": return await this.openPlan(input);
        case "reload_plan": return await this.reloadPlan(input);
        case "close_plan": return this.closePlan(input);
        case "list_open_plans": return { success: true, data: this.sessions.listOpenPlans() };
        case "summarize_plan": return this.withSession(input, (session) => summarizePlan(session.semanticPlan()));
        case "list_tree": return this.withSession(input, (session) => session.semanticPlan().root);
        case "get_node": return this.getNode(input);
        case "find_nodes": return this.findNodes(input);
        case "find_by_variable": return this.findByVariable(input);
        case "find_by_request": return this.findByRequest(input);
        case "find_disabled_nodes": return this.findNodes({ ...input, enabled: false });
        case "explain_execution_flow": return this.withSession(input, (session) => executionFlow(session.semanticPlan()));
        case "get_plan_language":
        case "export_plan_language": return this.getPlanLanguage(input);
        case "validate_plan_language": return this.validatePlanLanguage(input);
        case "roundtrip_plan_language": return this.withSession(input, (session) => roundTripPlanLanguage(session.semanticPlan()));
        case "explain_plan_language": return this.explainPlanLanguage(input);
        case "compare_plan_language": return this.comparePlanLanguage(input);
        case "validate_plan": return this.withSession(input, (session) => session.validate());
        case "add_http_request": return this.applySingleOperation(input, addHttpRequestOperation(input));
        case "add_http_defaults": return this.applySingleOperation(input, addHttpDefaultsOperation(input));
        case "add_header_manager": return this.applySingleOperation(input, addManagerOperation(input, "HeaderManager", "HeaderPanel", "HTTP Header Manager", { "HeaderManager.headers": jsonField(input.headers ?? {}) }));
        case "add_cookie_manager": return this.applySingleOperation(input, addManagerOperation(input, "CookieManager", "CookiePanel", "HTTP Cookie Manager"));
        case "add_cache_manager": return this.applySingleOperation(input, addManagerOperation(input, "CacheManager", "CacheManagerGui", "HTTP Cache Manager"));
        case "add_auth_manager": return this.applySingleOperation(input, addManagerOperation(input, "AuthManager", "AuthPanel", "HTTP Authorization Manager"));
        case "add_user_variables": return this.applySingleOperation(input, addUserVariablesOperation(input));
        case "add_csv_data_set": return this.applySingleOperation(input, addCsvDataSetOperation(input));
        case "add_counter": return this.applySingleOperation(input, addCounterOperation(input));
        case "add_random_variable": return this.applySingleOperation(input, addRandomVariableOperation(input));
        case "add_jdbc_data_source": return this.applySingleOperation(input, addJdbcDataSourceOperation(input));
        case "convert_hardcoded_host_to_variable": return this.convertHardcodedHostToVariable(input);
        case "add_jdbc_sampler": return this.applySingleOperation(input, addJdbcSamplerOperation(input));
        case "add_ftp_sampler": return this.applySingleOperation(input, addFtpSamplerOperation(input));
        case "add_tcp_sampler": return this.applySingleOperation(input, addTcpSamplerOperation(input));
        case "add_jms_sampler": return this.applySingleOperation(input, addJmsSamplerOperation(input));
        case "add_smtp_sampler": return this.applySingleOperation(input, addSmtpSamplerOperation(input));
        case "add_jsr223_sampler": return this.applySingleOperation(input, addJsr223SamplerOperation(input));
        case "add_debug_sampler": return this.applySingleOperation(input, addDebugSamplerOperation(input));
        case "add_node": return this.applySingleOperation(input, addNodeOperation(input));
        case "update_node_field": return this.applySingleOperation(input, updateFieldOperation(input));
        case "delete_node": return this.applySingleOperation(input, deleteNodeOperation(input));
        case "move_node": return this.applySingleOperation(input, moveNodeOperation(input));
        case "clone_node": return this.applySingleOperation(input, cloneNodeOperation(input));
        case "enable_node": return this.applySingleOperation(input, setEnabledOperation(input, true));
        case "disable_node": return this.applySingleOperation(input, setEnabledOperation(input, false));
        case "apply_semantic_patch": return this.applySemanticPatch(input);
        case "save_plan":
        case "save_plan_as": return await this.savePlan(input);
        default: return { success: false, error: `Tool ${name} is registered but has no executable handler yet.` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown tool error" };
    }
  }

  readResource(uri: string): ToolCallResult {
    const match = /^jmxpls:\/\/plans\/([^/]+)(?:\/(.*))?$/.exec(uri);
    if (!match) return { success: false, error: `Unsupported resource URI: ${uri}` };
    const [, planId, suffix = "summary"] = match;
    const session = this.sessions.get(planId ?? "");
    if (!session) return { success: false, error: `Unknown planId: ${planId}` };
    if (suffix === "summary") return { success: true, data: summarizePlan(session.semanticPlan()) };
    if (suffix === "tree") return { success: true, data: session.semanticPlan().root };
    if (suffix === "execution-flow") return { success: true, data: executionFlow(session.semanticPlan()) };
    if (suffix.startsWith("plan-language")) {
      const mode = suffix.split("/")[1] as PlanLanguageMode | undefined;
      return { success: true, data: projectPlanLanguage(session.semanticPlan(), { mode: mode ?? "outline" }) };
    }
    if (suffix === "diagnostics") return { success: true, data: session.diagnostics };
    if (suffix === "diff/semantic") return { success: true, data: session.latestDiff ?? null };
    return { success: false, error: `Unsupported resource suffix: ${suffix}` };
  }

  private async openPlan(input: ToolCallInput): Promise<ToolCallResult> {
    const session = await this.sessions.openPlan(requiredString(input, "path"));
    return { success: true, data: { ...session.summary(), summary: summarizePlan(session.semanticPlan()), defaultResource: `jmxpls://plans/${session.planId}/plan-language/outline` } };
  }

  private async reloadPlan(input: ToolCallInput): Promise<ToolCallResult> {
    const planId = requiredString(input, "planId");
    const existing = this.sessions.get(planId);
    if (!existing) return { success: false, error: `Unknown planId: ${planId}` };
    const sourcePath = existing.sourcePath;
    this.sessions.closePlan(planId);
    return this.openPlan({ path: sourcePath });
  }

  private closePlan(input: ToolCallInput): ToolCallResult {
    const planId = requiredString(input, "planId");
    return { success: this.sessions.closePlan(planId), data: { planId } };
  }

  private getNode(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => semanticNodes(session).find((node) => node.nodeId === requiredString(input, "nodeId")) ?? null);
  }

  private findNodes(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const role = optionalString(input, "role") as SemanticRole | undefined;
      const type = optionalString(input, "type");
      const name = optionalString(input, "name");
      const enabled = typeof input.enabled === "boolean" ? input.enabled : undefined;
      return semanticNodes(session).filter((node) => (role ? node.role === role : true) && (type ? node.type.includes(type) : true) && (name ? node.name.includes(name) : true) && (enabled === undefined ? true : node.enabled === enabled));
    });
  }

  private findByVariable(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const ids = new Set(session.semanticPlan().indexes.variables[requiredString(input, "variable")] ?? []);
      return semanticNodes(session).filter((node) => ids.has(node.nodeId));
    });
  }

  private findByRequest(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const method = optionalString(input, "method");
      const pathContains = optionalString(input, "pathContains") ?? optionalString(input, "path");
      const domainContains = optionalString(input, "domainContains") ?? optionalString(input, "domain");
      return semanticNodes(session).filter((node) => {
        if (node.role !== "sampler") return false;
        const searchable = `${node.name}\n${node.type}\n${JSON.stringify(node.fields)}`;
        return (method ? searchable.includes(method) : true) && (pathContains ? searchable.includes(pathContains) : true) && (domainContains ? searchable.includes(domainContains) : true);
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
    const parsed = parsePlanLanguage(requiredString(input, "text"));
    return { success: true, data: { valid: parsed.document.format === "jmxpls-plan-language", sourceFormat: parsed.sourceFormat } };
  }

  private explainPlanLanguage(input: ToolCallInput): ToolCallResult {
    const text = optionalString(input, "text");
    if (text) return { success: true, data: summarizePlanLanguage(parsePlanLanguage(text).document.nodes) };
    return this.withSession(input, (session) => summarizePlanLanguage(projectPlanLanguage(session.semanticPlan()).nodes));
  }

  private comparePlanLanguage(input: ToolCallInput): ToolCallResult {
    const left = parsePlanLanguage(requiredString(input, "left"));
    const right = parsePlanLanguage(requiredString(input, "right"));
    return { success: true, data: { equivalent: JSON.stringify(left.document) === JSON.stringify(right.document), left: summarizePlanLanguage(left.document.nodes), right: summarizePlanLanguage(right.document.nodes) } };
  }

  private convertHardcodedHostToVariable(input: ToolCallInput): ToolCallResult {
    const host = requiredString(input, "host");
    const variableName = requiredString(input, "variableName");
    return this.withSession(input, (session) => {
      const operations: SemanticPatchOperation[] = semanticNodes(session)
        .filter((node) => node.role === "sampler" && node.fields.domain === host)
        .map((node) => ({ op: "updateField", nodeId: node.nodeId, fieldPath: "HTTPSampler.domain", value: `\${${variableName}}` }));
      if (operations.length === 0) throw new Error(`No HTTP sampler domain matched ${host}`);
      return session.applyPatch(patchWithFlags(input, operations));
    });
  }

  private applySingleOperation(input: ToolCallInput, operation: SemanticPatchOperation): ToolCallResult {
    return this.applySemanticPatch({ ...input, patch: patchWithFlags(input, [operation]) });
  }

  private applySemanticPatch(input: ToolCallInput): ToolCallResult {
    const planId = requiredString(input, "planId");
    const patch = semanticPatchFromInput(input);
    const session = this.sessions.get(planId);
    if (!session) return { success: false, error: `Unknown planId: ${planId}` };
    return { success: true, data: session.applyPatch(patch) };
  }

  private async savePlan(input: ToolCallInput): Promise<ToolCallResult> {
    const planId = requiredString(input, "planId");
    const session = this.sessions.get(planId);
    if (!session) return { success: false, error: `Unknown planId: ${planId}` };
    return { success: true, data: await session.save(optionalString(input, "path"), input.backup !== false) };
  }

  private withSession(input: ToolCallInput, fn: (session: PlanSession) => unknown): ToolCallResult {
    const session = this.sessions.get(requiredString(input, "planId"));
    if (!session) return { success: false, error: `Unknown planId: ${String(input.planId)}` };
    return { success: true, data: fn(session) };
  }
}

function semanticNodes(session: PlanSession): SemanticNode[] { return flattenSemanticNodes(session.semanticPlan().root); }

function semanticPatchFromInput(input: ToolCallInput): SemanticPatch {
  const patch = input.patch as SemanticPatch | undefined;
  if (patch && Array.isArray(patch.operations)) return patch;
  if (Array.isArray(input.operations)) return patchWithFlags(input, input.operations as SemanticPatchOperation[]);
  throw new Error("patch.operations is required");
}

function patchWithFlags(input: ToolCallInput, operations: SemanticPatchOperation[]): SemanticPatch {
  const patch: SemanticPatch = { operations };
  if (typeof input.dryRun === "boolean") patch.dryRun = input.dryRun;
  if (typeof input.validate === "boolean") patch.validate = input.validate;
  return patch;
}

function addHttpRequestOperation(input: ToolCallInput): SemanticPatchOperation {
  const method = optionalString(input, "method") ?? "GET";
  const path = optionalString(input, "path") ?? "/";
  const fields = httpTargetFields(input, `${method} ${path}`);
  fields["HTTPSampler.method"] = method;
  fields["HTTPSampler.path"] = path;
  setIfPresent(fields, "HTTPSampler.postBodyRaw", optionalString(input, "body"));
  if (input.headers && typeof input.headers === "object" && !Array.isArray(input.headers)) fields["jmxpls.headers"] = jsonField(input.headers);
  return typedAddOperation(input, "HTTPSamplerProxy", "HttpTestSampleGui", fields);
}

function addHttpDefaultsOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "ConfigTestElement", "HttpDefaultsGui", httpTargetFields(input, "HTTP Request Defaults")); }
function addManagerOperation(input: ToolCallInput, nodeType: string, guiClass: string, defaultName: string, extraFields: Record<string, unknown> = {}): SemanticPatchOperation { return typedAddOperation(input, nodeType, guiClass, { name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true, ...extraFields }); }
function addUserVariablesOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "Arguments", "ArgumentsPanel", { name: optionalString(input, "name") ?? "User Defined Variables", enabled: optionalBoolean(input, "enabled") ?? true, "Arguments.arguments": jsonField(input.variables ?? {}) }); }

function addCsvDataSetOperation(input: ToolCallInput): SemanticPatchOperation {
  const fields: Record<string, unknown> = { name: optionalString(input, "name") ?? "CSV Data Set Config", enabled: optionalBoolean(input, "enabled") ?? true, filename: requiredString(input, "filename") };
  setIfPresent(fields, "variableNames", Array.isArray(input.variableNames) ? input.variableNames.join(",") : undefined);
  setIfPresent(fields, "delimiter", optionalString(input, "delimiter") ?? ",");
  setIfPresent(fields, "ignoreFirstLine", optionalBoolean(input, "ignoreFirstLine"));
  setIfPresent(fields, "recycle", optionalBoolean(input, "recycle"));
  setIfPresent(fields, "stopThread", optionalBoolean(input, "stopThread"));
  setIfPresent(fields, "shareMode", optionalString(input, "shareMode"));
  return typedAddOperation(input, "CSVDataSet", "TestBeanGUI", fields);
}

function addCounterOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "CounterConfig", "CounterConfigGui", compactFields({ name: optionalString(input, "name") ?? "Counter", enabled: optionalBoolean(input, "enabled") ?? true, "CounterConfig.name": requiredString(input, "variableName"), "CounterConfig.start": optionalScalar(input, "start") ?? 1, "CounterConfig.end": optionalScalar(input, "end"), "CounterConfig.incr": optionalScalar(input, "increment") ?? 1, "CounterConfig.format": optionalString(input, "format"), "CounterConfig.per_user": optionalBoolean(input, "perUser"), "CounterConfig.reset_on_tg_iteration": optionalBoolean(input, "resetOnThreadGroupIteration") }));
}

function addRandomVariableOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "RandomVariableConfig", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "Random Variable", enabled: optionalBoolean(input, "enabled") ?? true, variableName: requiredString(input, "variableName"), minimumValue: optionalScalar(input, "minimumValue") ?? 1, maximumValue: optionalScalar(input, "maximumValue") ?? 100, outputFormat: optionalString(input, "outputFormat"), perThread: optionalBoolean(input, "perThread") }));
}

function addJdbcDataSourceOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "JDBCDataSource", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "JDBC Connection Configuration", enabled: optionalBoolean(input, "enabled") ?? true, dataSource: requiredString(input, "dataSource"), dbUrl: optionalString(input, "dbUrl"), driver: optionalString(input, "driver"), username: optionalString(input, "username"), password: optionalString(input, "password") }));
}

function addJdbcSamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "JDBCSampler", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "JDBC Request", enabled: optionalBoolean(input, "enabled") ?? true, dataSource: requiredString(input, "dataSource"), query: requiredString(input, "query"), queryType: optionalString(input, "queryType") ?? "Select Statement", queryArguments: optionalString(input, "parameters"), variableNames: Array.isArray(input.variableNames) ? input.variableNames.join(",") : undefined, resultVariable: optionalString(input, "resultVariable") }));
}

function addFtpSamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "FTPSampler", "FtpTestSamplerGui", compactFields({ name: optionalString(input, "name") ?? "FTP Request", enabled: optionalBoolean(input, "enabled") ?? true, "FTPSampler.server": requiredString(input, "server"), "FTPSampler.remoteFile": requiredString(input, "remoteFile"), "FTPSampler.localFile": optionalString(input, "localFile"), "FTPSampler.action": optionalString(input, "action") ?? "get", "FTPSampler.binaryMode": optionalBoolean(input, "binaryMode") }));
}

function addTcpSamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "TCPSampler", "TCPSamplerGui", compactFields({ name: optionalString(input, "name") ?? "TCP Sampler", enabled: optionalBoolean(input, "enabled") ?? true, "TCPSampler.server": requiredString(input, "server"), "TCPSampler.port": optionalScalar(input, "port"), "TCPSampler.text": optionalString(input, "text"), "TCPSampler.classname": optionalString(input, "classname"), "TCPSampler.timeout": optionalScalar(input, "timeout") }));
}

function addJmsSamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "JMSSampler", "JmsSamplerGui", compactFields({ name: optionalString(input, "name") ?? "JMS Sampler", enabled: optionalBoolean(input, "enabled") ?? true, "JMSSampler.destination": requiredString(input, "destination"), "JMSSampler.message": optionalString(input, "message"), "JMSSampler.providerUrl": optionalString(input, "providerUrl") }));
}

function addSmtpSamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "SmtpSampler", "SmtpSamplerGui", compactFields({ name: optionalString(input, "name") ?? "SMTP Sampler", enabled: optionalBoolean(input, "enabled") ?? true, "SMTPSampler.server": requiredString(input, "server"), "SMTPSampler.receiver": requiredString(input, "recipient"), "SMTPSampler.sender": optionalString(input, "sender"), "SMTPSampler.subject": optionalString(input, "subject"), "SMTPSampler.message": optionalString(input, "body") }));
}

function addJsr223SamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "JSR223Sampler", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "JSR223 Sampler", enabled: optionalBoolean(input, "enabled") ?? true, scriptLanguage: optionalString(input, "language") ?? "groovy", script: optionalString(input, "script"), filename: optionalString(input, "filename"), parameters: optionalString(input, "parameters") }));
}

function addDebugSamplerOperation(input: ToolCallInput): SemanticPatchOperation {
  return typedAddOperation(input, "DebugSampler", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "Debug Sampler", enabled: optionalBoolean(input, "enabled") ?? true, displayJMeterVariables: optionalBoolean(input, "displayJMeterVariables") ?? true, displayJMeterProperties: optionalBoolean(input, "displayJMeterProperties") ?? false, displaySystemProperties: optionalBoolean(input, "displaySystemProperties") ?? false }));
}

function httpTargetFields(input: ToolCallInput, defaultName: string): Record<string, unknown> {
  const fields: Record<string, unknown> = { name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true };
  setIfPresent(fields, "HTTPSampler.protocol", optionalString(input, "protocol"));
  setIfPresent(fields, "HTTPSampler.domain", optionalString(input, "domain"));
  setIfPresent(fields, "HTTPSampler.port", optionalScalar(input, "port"));
  return fields;
}

function typedAddOperation(input: ToolCallInput, nodeType: string, guiClass: string, fields: Record<string, unknown>): SemanticPatchOperation {
  const parentNodeId = optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "parentNodeId");
  const index = optionalNumber(input, "index");
  return { op: "addNode", parentNodeId, nodeType, fields: { ...fields, guiClass }, ...(index !== undefined ? { index } : {}) };
}

function addNodeOperation(input: ToolCallInput): SemanticPatchOperation {
  const parentNodeId = optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "parentNodeId");
  const nodeType = optionalString(input, "nodeType") ?? optionalString(input, "type") ?? requiredString(input, "nodeType");
  const fields = objectInput(input, "fields");
  const index = optionalNumber(input, "index");
  return { op: "addNode", parentNodeId, nodeType, ...(fields ? { fields } : {}), ...(index !== undefined ? { index } : {}) };
}

function updateFieldOperation(input: ToolCallInput): SemanticPatchOperation { return { op: "updateField", nodeId: requiredString(input, "nodeId"), fieldPath: optionalString(input, "fieldPath") ?? optionalString(input, "field") ?? requiredString(input, "fieldPath"), value: input.value }; }
function deleteNodeOperation(input: ToolCallInput): SemanticPatchOperation { return { op: "deleteNode", nodeId: requiredString(input, "nodeId") }; }
function moveNodeOperation(input: ToolCallInput): SemanticPatchOperation { const toParentNodeId = optionalString(input, "toParentNodeId") ?? optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "toParentNodeId"); const index = optionalNumber(input, "index"); return { op: "moveNode", nodeId: requiredString(input, "nodeId"), toParentNodeId, ...(index !== undefined ? { index } : {}) }; }
function cloneNodeOperation(input: ToolCallInput): SemanticPatchOperation { const toParentNodeId = optionalString(input, "toParentNodeId") ?? optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "toParentNodeId"); const index = optionalNumber(input, "index"); return { op: "cloneNode", nodeId: requiredString(input, "nodeId"), toParentNodeId, ...(index !== undefined ? { index } : {}) }; }
function setEnabledOperation(input: ToolCallInput, enabled: boolean): SemanticPatchOperation { return { op: "setEnabled", nodeId: requiredString(input, "nodeId"), enabled }; }

function summarizePlanLanguage(nodes: Array<{ role: string; type: string; enabled: boolean; children?: unknown[] }>): Record<string, unknown> {
  const roles: Record<string, number> = {}, types: Record<string, number> = {};
  let disabled = 0, total = 0;
  const visit = (node: { role: string; type: string; enabled: boolean; children?: unknown[] }): void => { total += 1; roles[node.role] = (roles[node.role] ?? 0) + 1; types[node.type] = (types[node.type] ?? 0) + 1; if (!node.enabled) disabled += 1; for (const child of node.children ?? []) visit(child as { role: string; type: string; enabled: boolean; children?: unknown[] }); };
  for (const node of nodes) visit(node);
  return { totalNodes: total, disabledNodes: disabled, roles, types };
}

function requiredString(input: ToolCallInput, key: string): string { const value = input[key]; if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is required`); return value; }
function optionalString(input: ToolCallInput, key: string): string | undefined { const value = input[key]; return typeof value === "string" && value.length > 0 ? value : undefined; }
function optionalNumber(input: ToolCallInput, key: string): number | undefined { const value = input[key]; return typeof value === "number" && Number.isInteger(value) ? value : undefined; }
function optionalBoolean(input: ToolCallInput, key: string): boolean | undefined { const value = input[key]; return typeof value === "boolean" ? value : undefined; }
function optionalScalar(input: ToolCallInput, key: string): string | number | undefined { const value = input[key]; return typeof value === "string" || typeof value === "number" ? value : undefined; }
function objectInput(input: ToolCallInput, key: string): Record<string, unknown> | undefined { const value = input[key]; return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function setIfPresent(target: Record<string, unknown>, key: string, value: unknown): void { if (value !== undefined) target[key] = value; }
function compactFields(fields: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)); }
function jsonField(value: unknown): string { return JSON.stringify(value); }
