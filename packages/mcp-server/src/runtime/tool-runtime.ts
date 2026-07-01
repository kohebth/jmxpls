import {
  executionFlow,
  flattenSemanticNodes,
  parsePlanLanguage,
  projectPlanLanguage,
  roundTripPlanLanguage,
  serializePlanLanguage,
  SessionManager,
  summarizePlan,
  type PlanLanguageDocument,
  type PlanLanguageNode,
  type PlanLanguageMode,
  type SemanticNode,
  type SemanticPatch,
  type SemanticPatchOperation,
  type SemanticRole
} from "@jmxpls/core";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { validateToolInput } from "./input-validation.js";

const PLAN_LANGUAGE_ROLES = new Set(["testPlan", "threadGroup", "controller", "sampler", "config", "timer", "assertion", "extractor", "processor", "listener", "unknown"]);
const PLAN_LANGUAGE_MODES = new Set(["outline", "flow", "semantic", "full"]);
const PLAN_LANGUAGE_DETAILS = new Set(["compact", "expanded", "lossless-references", "raw-linked"]);
const PLAN_LANGUAGE_APPLY_MODES = new Set(["replace", "merge", "patch"]);

const MINIMAL_PLAN_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Minimal Plan" enabled="true">
      <stringProp name="TestPlan.comments" />
      <boolProp name="TestPlan.functional_mode">false</boolProp>
    </TestPlan>
    <hashTree/>
  </hashTree>
</jmeterTestPlan>`;

type PlanLanguageApplyMode = "replace" | "merge" | "patch";
type FindMatchMode = "contains" | "exact" | "regex" | "fuzzy";
type FindViewMode = "compact" | "full" | "raw";

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
        case "summarize_plan": return this.withSession(input, (session) => planSummaryResponse(session));
        case "list_tree": return this.withSession(input, (session) => wantsPagedTree(input) ? treePageResponse(session, input) : session.semanticPlan().root);
        case "get_node": return this.getNode(input);
        case "find_nodes": return this.findNodes(input);
        case "find_by_variable": return this.findByVariable(input);
        case "find_by_request": return this.findByRequest(input);
        case "find_disabled_nodes": return this.findNodes({ ...input, enabled: false });
        case "explain_execution_flow": return this.withSession(input, (session) => executionFlow(session.semanticPlan()));
        case "get_plan_language":
        case "export_plan_language": return this.getPlanLanguage(input);
        case "parse_plan_language": return this.parsePlanLanguage(input);
        case "import_plan_language": return this.importPlanLanguage(input);
        case "apply_plan_language": return this.applyPlanLanguage(input);
        case "validate_plan_language": return this.validatePlanLanguage(input);
        case "roundtrip_plan_language": return this.withSession(input, (session) => roundTripPlanLanguage(session.semanticPlan()));
        case "explain_plan_language": return this.explainPlanLanguage(input);
        case "compare_plan_language": return this.comparePlanLanguage(input);
        case "validate_plan": return this.withSession(input, (session) => session.validate());
        case "validate_tree": return this.validateTree(input);
        case "validate_hash_tree": return this.validateSubset(input, "hashTree", (code) => code.startsWith("JMX_HASH_TREE") || code === "JMX_ELEMENT_WITHOUT_HASHTREE");
        case "validate_component_schema": return this.validateSubset(input, "componentSchema", (code) => code.startsWith("JMX_COMPONENT") || code === "JMX_UNKNOWN_COMPONENT");
        case "validate_variables": return this.validateVariables(input);
        case "validate_files": return this.validateFiles(input);
        case "validate_with_jmeter": return this.validateWithJMeterFallback(input, optionalString(input, "mode") ?? "loadSaveReload");
        case "roundtrip_validate": return this.validateWithJMeterFallback(input, "loadSaveReload");
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
        case "add_constant_timer": return this.applySingleOperation(input, addConstantTimerOperation(input));
        case "add_random_timer": return this.applySingleOperation(input, addRandomTimerOperation(input));
        case "add_sync_timer": return this.applySingleOperation(input, addSyncTimerOperation(input));
        case "add_throughput_timer": return this.applySingleOperation(input, addThroughputTimerOperation(input));
        case "add_jsr223_timer": return this.applySingleOperation(input, addJsr223TimerOperation(input));
        case "add_response_assertion": return this.applySingleOperation(input, addResponseAssertionOperation(input));
        case "add_json_assertion": return this.applySingleOperation(input, addJsonAssertionOperation(input));
        case "add_xpath_assertion": return this.applySingleOperation(input, addXPathAssertionOperation(input));
        case "add_duration_assertion": return this.applySingleOperation(input, addDurationAssertionOperation(input));
        case "add_size_assertion": return this.applySingleOperation(input, addSizeAssertionOperation(input));
        case "add_jsr223_assertion": return this.applySingleOperation(input, addJsr223AssertionOperation(input));
        case "add_regex_extractor": return this.applySingleOperation(input, addRegexExtractorOperation(input));
        case "add_json_extractor": return this.applySingleOperation(input, addJsonExtractorOperation(input));
        case "add_boundary_extractor": return this.applySingleOperation(input, addBoundaryExtractorOperation(input));
        case "add_xpath_extractor": return this.applySingleOperation(input, addXPathExtractorOperation(input));
        case "add_css_extractor": return this.applySingleOperation(input, addCssExtractorOperation(input));
        case "add_jsr223_preprocessor": return this.applySingleOperation(input, addJsr223ProcessorOperation(input, "JSR223PreProcessor", "JSR223 PreProcessor"));
        case "add_jsr223_postprocessor": return this.applySingleOperation(input, addJsr223ProcessorOperation(input, "JSR223PostProcessor", "JSR223 PostProcessor"));
        case "add_jdbc_preprocessor": return this.applySingleOperation(input, addJdbcPreProcessorOperation(input));
        case "add_user_parameters": return this.applySingleOperation(input, addUserParametersOperation(input));
        case "add_url_rewriting_modifier": return this.applySingleOperation(input, addUrlRewritingModifierOperation(input));
        case "add_simple_data_writer": return this.applySingleOperation(input, addResultCollectorOperation(input, "SimpleDataWriter", "SimpleDataWriter", "Simple Data Writer"));
        case "add_summary_report": return this.applySingleOperation(input, addResultCollectorOperation(input, "ResultCollector", "SummaryReport", "Summary Report"));
        case "add_aggregate_report": return this.applySingleOperation(input, addResultCollectorOperation(input, "ResultCollector", "StatVisualizer", "Aggregate Report"));
        case "add_backend_listener": return this.applySingleOperation(input, addBackendListenerOperation(input));
        case "disable_gui_only_listeners": return this.disableGuiOnlyListeners(input);
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
    const { resourceUri, params } = parseResourceUri(uri);
    const match = /^jmxpls:\/\/plans\/([^/]+)(?:\/(.*))?$/.exec(resourceUri);
    if (!match) return { success: false, error: `Unsupported resource URI: ${uri}` };
    const [, planId, suffix = "summary"] = match;
    const session = this.sessions.get(planId ?? "");
    if (!session) return { success: false, error: `Unknown planId: ${planId}` };
    if (suffix === "summary") return { success: true, data: planSummaryResponse(session) };
    if (suffix === "tree") return { success: true, data: treePageResponse(session, params) };
    if (suffix === "execution-flow") return { success: true, data: executionFlow(session.semanticPlan()) };
    if (suffix.startsWith("plan-language")) return { success: true, data: projectPlanLanguage(session.semanticPlan(), { mode: (suffix.split("/")[1] as PlanLanguageMode | undefined) ?? "outline" }) };
    const nodeMatch = /^node\/([^/]+)(?:\/children)?$/.exec(suffix);
    if (nodeMatch && suffix.endsWith("/children")) return { success: true, data: nodeChildrenPageResponse(session, nodeMatch[1] ?? "", params) };
    if (nodeMatch) return { success: true, data: semanticNodes(session).find((node) => node.nodeId === nodeMatch[1]) ?? null };
    if (suffix === "diagnostics") return { success: true, data: session.diagnostics };
    if (suffix === "diff/semantic") return { success: true, data: session.latestDiff ?? null };
    return { success: false, error: `Unsupported resource suffix: ${suffix}` };
  }

  private async openPlan(input: ToolCallInput): Promise<ToolCallResult> { const session = await this.sessions.openPlan(requiredString(input, "path")); return { success: true, data: { ...session.summary(), summary: planSummaryResponse(session), defaultResource: `jmxpls://plans/${session.planId}/plan-language/outline`, nextSuggestedResources: nextSuggestedResources(session.planId) } }; }
  private async reloadPlan(input: ToolCallInput): Promise<ToolCallResult> { const planId = requiredString(input, "planId"); const existing = this.sessions.get(planId); if (!existing) return { success: false, error: `Unknown planId: ${planId}` }; const sourcePath = existing.sourcePath; this.sessions.closePlan(planId); return this.openPlan({ path: sourcePath }); }
  private closePlan(input: ToolCallInput): ToolCallResult { const planId = requiredString(input, "planId"); return { success: this.sessions.closePlan(planId), data: { planId } }; }
  private getNode(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => semanticNodes(session).find((node) => node.nodeId === requiredString(input, "nodeId")) ?? null); }
  private findNodes(input: ToolCallInput): ToolCallResult {
    return this.withSession(input, (session) => {
      const role = optionalString(input, "role") as SemanticRole | undefined;
      const type = optionalString(input, "type");
      const name = optionalString(input, "name");
      const path = optionalString(input, "path");
      const parentNodeId = optionalString(input, "parentNodeId");
      const enabled = typeof input.enabled === "boolean" ? input.enabled : undefined;
      const match = findMatchMode(input);
      const view = findViewMode(input);
      const roots = scopedRoots(session.semanticPlan().root, optionalString(input, "subtreeNodeId") ?? optionalString(input, "nodeId"));
      const allNodes = semanticNodes(session);
      const nodesById = new Map(allNodes.map((node) => [node.nodeId, node]));
      const variableNodeIds = optionalString(input, "variable") ? new Set(session.semanticPlan().indexes.variables[optionalString(input, "variable") ?? ""] ?? []) : undefined;
      const matches = flattenSemanticNodes(roots).filter((node) =>
        (role ? node.role === role : true) &&
        (type ? textMatches(node.type, type, match) : true) &&
        (name ? textMatches(node.name, name, match) : true) &&
        (path ? textMatches(node.path, path, match) : true) &&
        (variableNodeIds ? variableNodeIds.has(node.nodeId) : true) &&
        matchesRequestFilters(node, input, match) &&
        matchesPluginClass(node, optionalString(input, "pluginClass"), match) &&
        matchesParentFilters(node, nodesById.get(node.parentNodeId ?? ""), input, match) &&
        matchesChildFilters(node, input, match) &&
        matchesFieldFilters(node, input, match) &&
        (parentNodeId ? node.parentNodeId === parentNodeId : true) &&
        (enabled === undefined ? true : node.enabled === enabled)
      );
      const data = matches.map((node) => formatFindNode(session.planId, node, view));
      return wantsPagedFindNodes(input) ? pagedNodeList(session.planId, data, input) : data;
    });
  }
  private findByVariable(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => semanticNodes(session).filter((node) => new Set(session.semanticPlan().indexes.variables[requiredString(input, "variable")] ?? []).has(node.nodeId))); }
  private findByRequest(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => { const method = optionalString(input, "method"); const pathContains = optionalString(input, "pathContains") ?? optionalString(input, "path"); const domainContains = optionalString(input, "domainContains") ?? optionalString(input, "domain"); return semanticNodes(session).filter((node) => { if (node.role !== "sampler") return false; const searchable = `${node.name}\n${node.type}\n${JSON.stringify(node.fields)}`; return (method ? searchable.includes(method) : true) && (pathContains ? searchable.includes(pathContains) : true) && (domainContains ? searchable.includes(domainContains) : true); }); }); }
  private getPlanLanguage(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => { const mode = (optionalString(input, "mode") ?? "outline") as PlanLanguageMode; const format = optionalString(input, "format") ?? "object"; const document = projectPlanLanguage(session.semanticPlan(), { mode }); return format === "json" || format === "yaml" ? serializePlanLanguage(document, format) : document; }); }
  private validatePlanLanguage(input: ToolCallInput): ToolCallResult {
    const parsed = parsePlanLanguage(requiredString(input, "text"));
    const diagnostics = validatePlanLanguageDocument(parsed.document);
    return {
      success: true,
      data: {
        valid: parsed.document.format === "jmxpls-plan-language" && diagnostics.length === 0,
        sourceFormat: parsed.sourceFormat,
        diagnostics
      }
    };
  }
  private parsePlanLanguage(input: ToolCallInput): ToolCallResult {
    const parsed = parsePlanLanguage(requiredString(input, "text"));
    const diagnostics = validatePlanLanguageDocument(parsed.document);
    return {
      success: true,
      data: {
        valid: parsed.document.format === "jmxpls-plan-language" && diagnostics.length === 0,
        sourceFormat: parsed.sourceFormat,
        document: parsed.document,
        diagnostics
      }
    };
  }
  private async importPlanLanguage(input: ToolCallInput): Promise<ToolCallResult> {
    const parsed = this.parsePlanLanguageInput(input);
    if (parsed.diagnostics.length > 0) {
      return { success: false, error: `Invalid plan language document: ${parsed.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}` };
    }

    const mode = this.planLanguageApplyMode(input);
    const targetPath = this.resolveImportTargetPath(optionalString(input, "targetPath"));
    const session = await this.sessions.openPlan(targetPath);
    const result = this.applyPlanLanguageDocument(session, parsed.document, mode, input, true);
    return {
      ...result,
      data: {
        ...(typeof result.data === "object" && result.data !== null ? result.data : {}),
        sourcePath: targetPath,
        mode,
        sourceFormat: parsed.sourceFormat
      }
    };
  }
  private applyPlanLanguage(input: ToolCallInput): ToolCallResult {
    const planId = requiredString(input, "planId");
    const session = this.sessions.get(planId);
    if (!session) return { success: false, error: `Unknown planId: ${planId}` };

    const parsed = this.parsePlanLanguageInput(input);
    if (parsed.diagnostics.length > 0) {
      return { success: false, error: `Invalid plan language document: ${parsed.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}` };
    }

    const mode = this.planLanguageApplyMode(input);
    const result = this.applyPlanLanguageDocument(session, parsed.document, mode, input, false);
    return {
      ...result,
      data: {
        ...(typeof result.data === "object" && result.data !== null ? result.data : {}),
        mode,
        sourceFormat: parsed.sourceFormat
      }
    };
  }
  private applyPlanLanguageDocument(
    session: PlanSession,
    document: PlanLanguageDocument,
    mode: PlanLanguageApplyMode,
    input: ToolCallInput,
    isImport: boolean
  ): ToolCallResult {
    const root = session.semanticPlan().root[0];
    if (!root) return { success: false, error: `No root node in target plan: ${session.planId}` };

    const sourceRoot = document.nodes[0]?.role === "testPlan" ? document.nodes[0] : undefined;
    const sourceChildren = sourceRoot ? sourceRoot.children ?? [] : document.nodes;

    if (sourceRoot) {
      this.applyNodeChanges(session, root.nodeId, sourceRoot, input);
    }

    if (mode === "replace") {
      this.deleteChildren(session, root.nodeId, input);
    }

    this.syncPlanLanguageChildren(session, sourceChildren, root.nodeId, mode, input);

    return {
      success: true,
      data: {
        planId: session.planId,
        planPath: session.sourcePath,
        planSummary: summarizePlan(session.semanticPlan()),
        ...(isImport ? {} : { operationMode: mode })
      }
    };
  }
  private syncPlanLanguageChildren(session: PlanSession, children: PlanLanguageNode[], parentNodeId: string, mode: PlanLanguageApplyMode, input: ToolCallInput): void {
    const used = new Set<string>();
    for (const source of children) {
      const currentChildren = this.childrenOf(session, parentNodeId);
      const match = this.findMatchingChild(currentChildren, source, used);
      let targetNodeId: string;

      if (mode === "replace" && !match) {
        targetNodeId = this.addPlanLanguageNode(session, parentNodeId, source, input, currentChildren.length);
        used.add(targetNodeId);
      } else if (match) {
        this.applyNodeChanges(session, match.nodeId, source, input);
        targetNodeId = match.nodeId;
        used.add(match.nodeId);
      } else {
        targetNodeId = this.addPlanLanguageNode(session, parentNodeId, source, input, currentChildren.length);
        used.add(targetNodeId);
      }

      this.syncPlanLanguageChildren(session, source.children ?? [], targetNodeId, mode, input);
    }
  }
  private addPlanLanguageNode(session: PlanSession, parentNodeId: string, source: PlanLanguageNode, input: ToolCallInput, index?: number): string {
    const existing = new Set(this.childrenOf(session, parentNodeId).map((node) => node.nodeId));
    const addOperation: SemanticPatchOperation = {
      op: "addNode",
      parentNodeId,
      nodeType: source.type,
      fields: {
        name: source.name,
        enabled: source.enabled,
        ...(source.fields ?? {})
      }
    };
    if (index !== undefined) {
      addOperation.index = index;
    }
    const result = session.applyPatch(patchWithFlags(input, [addOperation]));
    const added = flattenSemanticNodes(result.semantic.root).find((node) => node.parentNodeId === parentNodeId && !existing.has(node.nodeId) && node.type === source.type);
    if (!added) {
      const fallback = flattenSemanticNodes(result.semantic.root).find((node) => !existing.has(node.nodeId) && node.type === source.type);
      if (!fallback) throw new Error(`Unable to add node ${source.type}:${source.name}`);
      return fallback.nodeId;
    }
    return added.nodeId;
  }
  private applyNodeChanges(session: PlanSession, targetNodeId: string, source: PlanLanguageNode, input: ToolCallInput): void {
    const target = semanticNodes(session).find((node) => node.nodeId === targetNodeId);
    if (!target) return;
    const operations: SemanticPatchOperation[] = [];

    if (target.name !== source.name) {
      operations.push({ op: "updateField", nodeId: targetNodeId, fieldPath: "name", value: source.name });
    }

    if (target.enabled !== source.enabled) {
      operations.push({ op: "setEnabled", nodeId: targetNodeId, enabled: source.enabled });
    }

    const fields = source.fields ?? {};
    for (const [fieldPath, value] of Object.entries(fields)) {
      if (fieldPath === "name" || fieldPath === "enabled" || value === undefined) continue;
      const path = fieldPath === "guiClass" ? "attributes.guiclass" : fieldPath;
      operations.push({ op: "updateField", nodeId: targetNodeId, fieldPath: path, value });
    }

    if (operations.length > 0) {
      session.applyPatch(patchWithFlags(input, operations));
    }
  }
  private deleteChildren(session: PlanSession, parentNodeId: string, input: ToolCallInput): void {
    const current = this.childrenOf(session, parentNodeId);
    if (current.length === 0) {
      return;
    }
    session.applyPatch(patchWithFlags(input, current.map((node) => ({ op: "deleteNode", nodeId: node.nodeId }))));
  }
  private childrenOf(session: PlanSession, parentNodeId: string): SemanticNode[] {
    return semanticNodes(session).filter((node) => node.parentNodeId === parentNodeId);
  }
  private findMatchingChild(children: SemanticNode[], source: PlanLanguageNode, used: Set<string>): SemanticNode | undefined {
    const candidates = children.filter((node) => !used.has(node.nodeId));
    const exact = candidates.find((node) => node.name === source.name && node.type === source.type && node.role === source.role);
    if (exact) return exact;
    const typeMatch = candidates.find((node) => node.type === source.type && node.role === source.role);
    if (typeMatch) return typeMatch;
    const nameMatch = candidates.find((node) => node.name === source.name);
    return nameMatch;
  }
  private parsePlanLanguageInput(input: ToolCallInput): { sourceFormat: "json" | "yaml"; document: PlanLanguageDocument; diagnostics: Array<{ code: string; message: string; field?: string }> } {
    const text = optionalString(input, "text") ?? readFileSync(resolve(requiredString(input, "path")), "utf8");
    const parsed = parsePlanLanguage(text);
    return { ...parsed, diagnostics: validatePlanLanguageDocument(parsed.document) };
  }
  private planLanguageApplyMode(input: ToolCallInput): PlanLanguageApplyMode {
    const inputMode = optionalString(input, "mode");
    if (typeof inputMode === "string" && PLAN_LANGUAGE_APPLY_MODES.has(inputMode)) {
      return inputMode as PlanLanguageApplyMode;
    }
    return "patch";
  }
  private resolveImportTargetPath(requestedPath?: string): string {
    if (requestedPath) {
      const resolved = resolve(requestedPath);
      if (!existsSync(resolved)) {
        mkdirSync(dirname(resolved), { recursive: true });
        writeFileSync(resolved, MINIMAL_PLAN_TEMPLATE);
      }
      return resolved;
    }

    const dir = mkdtempSync(join(tmpdir(), "jmxpls-import-"));
    const path = join(dir, "plan.jmx");
    writeFileSync(path, MINIMAL_PLAN_TEMPLATE);
    return path;
  }
  private explainPlanLanguage(input: ToolCallInput): ToolCallResult {
    const text = optionalString(input, "text");
    if (text) {
      const parsed = parsePlanLanguage(text);
      const diagnostics = validatePlanLanguageDocument(parsed.document);
      if (diagnostics.length > 0) {
        return { success: false, error: `Invalid plan language text: ${diagnostics.map((diagnostic) => `${diagnostic.field ?? "document"}: ${diagnostic.message}`).join("; ")}` };
      }
      return { success: true, data: summarizePlanLanguage(parsed.document.nodes) };
    }
    return this.withSession(input, (session) => summarizePlanLanguage(projectPlanLanguage(session.semanticPlan()).nodes));
  }
  private comparePlanLanguage(input: ToolCallInput): ToolCallResult {
    const left = parsePlanLanguage(requiredString(input, "left"));
    const right = parsePlanLanguage(requiredString(input, "right"));
    const leftDiagnostics = validatePlanLanguageDocument(left.document);
    const rightDiagnostics = validatePlanLanguageDocument(right.document);
    if (leftDiagnostics.length > 0 || rightDiagnostics.length > 0) {
      const messages = leftDiagnostics.concat(rightDiagnostics).map((diagnostic) => diagnostic.message);
      return { success: false, error: `Invalid plan language comparison input: ${messages.join("; ")}` };
    }
    return {
      success: true,
      data: {
        equivalent: comparePlanLanguageDocuments(left.document, right.document),
        left: summarizePlanLanguage(left.document.nodes),
        right: summarizePlanLanguage(right.document.nodes)
      }
    };
  }
  private convertHardcodedHostToVariable(input: ToolCallInput): ToolCallResult { const host = requiredString(input, "host"); const variableName = requiredString(input, "variableName"); return this.withSession(input, (session) => { const operations: SemanticPatchOperation[] = semanticNodes(session).filter((node) => node.role === "sampler" && node.fields.domain === host).map((node) => ({ op: "updateField", nodeId: node.nodeId, fieldPath: "HTTPSampler.domain", value: `\${${variableName}}` })); if (operations.length === 0) throw new Error(`No HTTP sampler domain matched ${host}`); return session.applyPatch(patchWithFlags(input, operations)); }); }
  private validateTree(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => ({ ...session.validate(), treeNodeCount: semanticNodes(session).length, rootNodeCount: session.semanticPlan().root.length })); }
  private validateSubset(input: ToolCallInput, scope: string, predicate: (code: string) => boolean): ToolCallResult { return this.withSession(input, (session) => { const diagnostics = session.validate().diagnostics.filter((diagnostic) => predicate(diagnostic.code)); return { scope, valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error" && diagnostic.severity !== "fatal"), diagnostics }; }); }
  private validateVariables(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => { const variables = session.semanticPlan().indexes.variables; return { valid: true, variableCount: Object.keys(variables).length, variables }; }); }
  private validateFiles(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => { const diagnostics = semanticNodes(session).flatMap((node) => ["filename", "Filename", "path"].flatMap((field) => unsafePathDiagnostics(node, field, node.fields[field]))); return { valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics }; }); }
  private validateWithJMeterFallback(input: ToolCallInput, mode: string): ToolCallResult { return this.withSession(input, (session) => { const staticValidation = session.validate(); const severity = input.strict === true ? "error" : "warning"; const bridgeDiagnostic = { code: "JMX_JMETER_BRIDGE_NOT_CONFIGURED", severity, message: "JMeter bridge validation is not configured in this runtime yet; returned static validation fallback.", fixSuggestion: "Configure the Java bridge before using strict JMeter-backed validation." }; const diagnostics = [bridgeDiagnostic, ...staticValidation.diagnostics]; return { mode, jmeterBacked: false, valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error" && diagnostic.severity !== "fatal"), diagnostics, staticValidation }; }); }
  private disableGuiOnlyListeners(input: ToolCallInput): ToolCallResult { return this.withSession(input, (session) => { const guiOnly = new Set(["ViewResultsTree", "ViewResultsFullVisualizer", "TableVisualizer", "GraphVisualizer", "AggregateGraph", "MailerVisualizer"]); const operations: SemanticPatchOperation[] = semanticNodes(session).filter((node) => node.role === "listener" && node.enabled && guiOnly.has(node.type)).map((node) => ({ op: "setEnabled", nodeId: node.nodeId, enabled: false })); return session.applyPatch(patchWithFlags(input, operations)); }); }
  private applySingleOperation(input: ToolCallInput, operation: SemanticPatchOperation): ToolCallResult { return this.applySemanticPatch({ ...input, patch: patchWithFlags(input, [operation]) }); }
  private applySemanticPatch(input: ToolCallInput): ToolCallResult { const planId = requiredString(input, "planId"); const patch = semanticPatchFromInput(input); const session = this.sessions.get(planId); if (!session) return { success: false, error: `Unknown planId: ${planId}` }; return { success: true, data: session.applyPatch(patch) }; }
  private async savePlan(input: ToolCallInput): Promise<ToolCallResult> { const planId = requiredString(input, "planId"); const session = this.sessions.get(planId); if (!session) return { success: false, error: `Unknown planId: ${planId}` }; return { success: true, data: await session.save(optionalString(input, "path"), input.backup !== false) }; }
  private withSession(input: ToolCallInput, fn: (session: PlanSession) => unknown): ToolCallResult { const session = this.sessions.get(requiredString(input, "planId")); if (!session) return { success: false, error: `Unknown planId: ${String(input.planId)}` }; return { success: true, data: fn(session) }; }
}

type TreeNodePageItem = {
  nodeId: string;
  parentNodeId?: string;
  depth: number;
  path: string;
  role: SemanticRole;
  type: string;
  name: string;
  enabled: boolean;
  childCount: number;
  hasChildren: boolean;
  nextSuggestedResources: string[];
};

function semanticNodes(session: PlanSession): SemanticNode[] { return flattenSemanticNodes(session.semanticPlan().root); }
function planSummaryResponse(session: PlanSession): Record<string, unknown> {
  const summary = summarizePlan(session.semanticPlan());
  const samplerLimit = 50;
  const omittedSamplers = Math.max(0, summary.samplers.length - samplerLimit);
  return {
    ...summary,
    samplerCount: summary.samplers.length,
    samplers: summary.samplers.slice(0, samplerLimit),
    omittedSamplers,
    nextSuggestedResources: nextSuggestedResources(session.planId)
  };
}

function treePageResponse(session: PlanSession, input: ToolCallInput): Record<string, unknown> {
  const roots = scopedRoots(session.semanticPlan().root, optionalString(input, "subtreeNodeId") ?? optionalString(input, "nodeId"));
  return pagedNodeList(session.planId, flattenTreePageItems(session.planId, roots, pageDepth(input)), input);
}

function nodeChildrenPageResponse(session: PlanSession, nodeId: string, input: ToolCallInput): Record<string, unknown> {
  const node = semanticNodes(session).find((candidate) => candidate.nodeId === nodeId);
  if (!node) {
    return { items: [], total: 0, nextSuggestedResources: nextSuggestedResources(session.planId) };
  }
  return pagedNodeList(session.planId, flattenTreePageItems(session.planId, node.children, pageDepth(input)), input);
}

function pagedNodeList<T>(planId: string, items: T[], input: ToolCallInput): Record<string, unknown> {
  const limit = pageLimit(input);
  const page = boundedPage(items, limit, optionalString(input, "cursor"), pageByteBudget(input));
  return {
    items: page.items,
    limit,
    total: items.length,
    ...(page.byteBudget ? { byteBudget: page.byteBudget } : {}),
    ...(page.truncatedByBudget ? { truncatedByBudget: true } : {}),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    nextSuggestedResources: page.nextCursor ? [`jmxpls://plans/${planId}/tree?cursor=${page.nextCursor}&limit=${limit}`] : nextSuggestedResources(planId)
  };
}

function boundedPage<T>(items: T[], limit: number, cursor?: string, byteBudget?: number): { items: T[]; nextCursor?: string; byteBudget?: number; truncatedByBudget?: boolean } {
  const start = cursor ? Number(cursor) : 0;
  const selected = items.slice(start, start + limit);
  const next = start + selected.length;
  if (!byteBudget) {
    return { items: selected, ...(next < items.length ? { nextCursor: String(next) } : {}) };
  }

  let pageItems = selected;
  while (pageItems.length > 1 && Buffer.byteLength(JSON.stringify(pageItems), "utf8") > byteBudget) {
    pageItems = pageItems.slice(0, -1);
  }

  const budgetNext = start + pageItems.length;
  return {
    items: pageItems,
    byteBudget,
    ...(pageItems.length < selected.length ? { truncatedByBudget: true } : {}),
    ...(budgetNext < items.length ? { nextCursor: String(budgetNext) } : {})
  };
}

function flattenTreePageItems(planId: string, nodes: SemanticNode[], maxDepth: number, depth = 0): TreeNodePageItem[] {
  if (depth > maxDepth) {
    return [];
  }
  return nodes.flatMap((node) => [
    compactTreeItem(planId, node, depth),
    ...flattenTreePageItems(planId, node.children, maxDepth, depth + 1)
  ]);
}

function compactTreeItem(planId: string, node: SemanticNode, depth: number): TreeNodePageItem {
  return {
    nodeId: node.nodeId,
    ...(node.parentNodeId ? { parentNodeId: node.parentNodeId } : {}),
    depth,
    path: node.path,
    role: node.role,
    type: node.type,
    name: node.name,
    enabled: node.enabled,
    childCount: node.children.length,
    hasChildren: node.children.length > 0,
    nextSuggestedResources: [`jmxpls://plans/${planId}/node/${node.nodeId}`, `jmxpls://plans/${planId}/node/${node.nodeId}/children?limit=50`]
  };
}

function formatFindNode(planId: string, node: SemanticNode, view: FindViewMode): SemanticNode | TreeNodePageItem | Record<string, unknown> {
  if (view === "compact") {
    return compactTreeItem(planId, node, node.path.split("/").filter(Boolean).length - 1);
  }
  if (view === "raw") {
    return {
      nodeId: node.nodeId,
      ...(node.parentNodeId ? { parentNodeId: node.parentNodeId } : {}),
      rawRef: node.rawRef,
      type: node.type,
      name: node.name,
      enabled: node.enabled
    };
  }
  return node;
}

function scopedRoots(nodes: SemanticNode[], nodeId?: string): SemanticNode[] {
  if (!nodeId) {
    return nodes;
  }
  const node = flattenSemanticNodes(nodes).find((candidate) => candidate.nodeId === nodeId);
  return node ? [node] : [];
}

function pageLimit(input: ToolCallInput): number {
  const value = optionalInteger(input, "limit");
  if (value === undefined) {
    return 50;
  }
  return Math.min(Math.max(value, 1), 200);
}

function pageDepth(input: ToolCallInput): number {
  const value = optionalInteger(input, "depth");
  if (value === undefined) {
    return 2;
  }
  return Math.min(Math.max(value, 0), 20);
}

function pageByteBudget(input: ToolCallInput): number | undefined {
  const value = optionalInteger(input, "byteBudget");
  if (value === undefined) {
    return undefined;
  }
  return Math.min(Math.max(value, 256), 1024 * 1024);
}

function wantsPagedTree(input: ToolCallInput): boolean {
  return ["limit", "cursor", "depth", "byteBudget", "subtreeNodeId", "nodeId"].some((key) => key in input);
}

function wantsPagedFindNodes(input: ToolCallInput): boolean {
  return wantsPagedTree(input) || "view" in input;
}

function findMatchMode(input: ToolCallInput): FindMatchMode {
  const value = optionalString(input, "match");
  return value === "exact" || value === "regex" || value === "fuzzy" ? value : "contains";
}

function findViewMode(input: ToolCallInput): FindViewMode {
  const value = optionalString(input, "view");
  return value === "compact" || value === "raw" ? value : "full";
}

function textMatches(value: string, pattern: string, mode: FindMatchMode): boolean {
  switch (mode) {
    case "exact":
      return value === pattern;
    case "regex":
      return new RegExp(pattern).test(value);
    case "fuzzy":
      return fuzzyMatches(value, pattern);
    case "contains":
    default:
      return value.includes(pattern);
  }
}

function matchesRequestFilters(node: SemanticNode, input: ToolCallInput, mode: FindMatchMode): boolean {
  const method = optionalString(input, "method");
  const requestPath = optionalString(input, "requestPath") ?? optionalString(input, "pathContains");
  const domain = optionalString(input, "domain") ?? optionalString(input, "domainContains");
  if (!method && !requestPath && !domain) {
    return true;
  }
  if (node.role !== "sampler") {
    return false;
  }
  const searchable = `${node.name}\n${node.type}\n${JSON.stringify(node.fields)}`;
  return (method ? textMatches(fieldText(node, "method") ?? searchable, method, mode) : true) &&
    (requestPath ? textMatches(fieldText(node, "path") ?? searchable, requestPath, mode) : true) &&
    (domain ? textMatches(fieldText(node, "domain") ?? searchable, domain, mode) : true);
}

function matchesPluginClass(node: SemanticNode, pluginClass: string | undefined, mode: FindMatchMode): boolean {
  if (!pluginClass) {
    return true;
  }
  const candidates = [node.type, fieldText(node, "testclass"), fieldText(node, "classname"), fieldText(node, "guiClass")].filter((value): value is string => value !== undefined);
  return candidates.some((candidate) => textMatches(candidate, pluginClass, mode));
}

function matchesParentFilters(node: SemanticNode, parent: SemanticNode | undefined, input: ToolCallInput, mode: FindMatchMode): boolean {
  const role = optionalString(input, "parentRole");
  const type = optionalString(input, "parentType");
  const name = optionalString(input, "parentName");
  if (!role && !type && !name) {
    return true;
  }
  return parent !== undefined &&
    (role ? parent.role === role : true) &&
    (type ? textMatches(parent.type, type, mode) : true) &&
    (name ? textMatches(parent.name, name, mode) : true);
}

function matchesChildFilters(node: SemanticNode, input: ToolCallInput, mode: FindMatchMode): boolean {
  const role = optionalString(input, "childRole");
  const type = optionalString(input, "childType");
  const name = optionalString(input, "childName");
  if (!role && !type && !name) {
    return true;
  }
  return node.children.some((child) =>
    (role ? child.role === role : true) &&
    (type ? textMatches(child.type, type, mode) : true) &&
    (name ? textMatches(child.name, name, mode) : true)
  );
}

function matchesFieldFilters(node: SemanticNode, input: ToolCallInput, mode: FindMatchMode): boolean {
  const field = optionalString(input, "field");
  const fieldValue = optionalString(input, "fieldValue");
  if (!field && !fieldValue) {
    return true;
  }
  return Object.entries(node.fields).some(([key, value]) =>
    (field ? textMatches(key, field, mode) : true) &&
    (fieldValue ? textMatches(String(value), fieldValue, mode) : true)
  );
}

function fieldText(node: SemanticNode, field: string): string | undefined {
  for (const [key, value] of Object.entries(node.fields)) {
    if (key === field || key.endsWith(`.${field}`)) {
      return String(value);
    }
  }
  return undefined;
}

function fuzzyMatches(value: string, pattern: string): boolean {
  const needle = searchToken(pattern);
  if (!needle) {
    return true;
  }
  return searchTokens(value).some((candidate) => candidate.includes(needle) || levenshtein(candidate, needle) <= Math.max(2, Math.floor(needle.length * 0.35)));
}

function searchTokens(value: string): string[] {
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return [tokens.join(""), ...tokens];
}

function searchToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function levenshtein(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current.push(left[leftIndex] === right[rightIndex] ? previous[rightIndex] ?? 0 : Math.min(previous[rightIndex] ?? 0, previous[rightIndex + 1] ?? 0, current[rightIndex] ?? 0) + 1);
    }
    previous = current;
  }
  return previous[right.length] ?? left.length;
}

function nextSuggestedResources(planId: string): string[] {
  return [
    `jmxpls://plans/${planId}/plan-language/outline`,
    `jmxpls://plans/${planId}/tree?limit=50&depth=2`,
    `jmxpls://plans/${planId}/diagnostics`
  ];
}

function parseResourceUri(uri: string): { resourceUri: string; params: ToolCallInput } {
  const [resourceUri = "", query = ""] = uri.split("?", 2);
  const params: ToolCallInput = {};
  for (const [key, value] of new URLSearchParams(query)) {
    const numeric = Number(value);
    params[key] = Number.isInteger(numeric) && value.trim() !== "" ? numeric : value;
  }
  return { resourceUri, params };
}

function semanticPatchFromInput(input: ToolCallInput): SemanticPatch { const patch = input.patch as SemanticPatch | undefined; if (patch && Array.isArray(patch.operations)) return patch; if (Array.isArray(input.operations)) return patchWithFlags(input, input.operations as SemanticPatchOperation[]); throw new Error("patch.operations is required"); }
function patchWithFlags(input: ToolCallInput, operations: SemanticPatchOperation[]): SemanticPatch { return { operations, ...(typeof input.dryRun === "boolean" ? { dryRun: input.dryRun } : {}), ...(typeof input.validate === "boolean" ? { validate: input.validate } : {}) }; }
function typedAddOperation(input: ToolCallInput, nodeType: string, guiClass: string, fields: Record<string, unknown>): SemanticPatchOperation { const parentNodeId = optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "parentNodeId"); const index = optionalNumber(input, "index"); return { op: "addNode", parentNodeId, nodeType, fields: { ...fields, guiClass }, ...(index !== undefined ? { index } : {}) }; }

function addHttpRequestOperation(input: ToolCallInput): SemanticPatchOperation { const method = optionalString(input, "method") ?? "GET"; const path = optionalString(input, "path") ?? "/"; const fields = httpTargetFields(input, `${method} ${path}`); fields["HTTPSampler.method"] = method; fields["HTTPSampler.path"] = path; setIfPresent(fields, "HTTPSampler.postBodyRaw", optionalString(input, "body")); if (isObject(input.headers)) fields["jmxpls.headers"] = jsonField(input.headers); return typedAddOperation(input, "HTTPSamplerProxy", "HttpTestSampleGui", fields); }
function addHttpDefaultsOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "ConfigTestElement", "HttpDefaultsGui", httpTargetFields(input, "HTTP Request Defaults")); }
function addManagerOperation(input: ToolCallInput, nodeType: string, guiClass: string, defaultName: string, extraFields: Record<string, unknown> = {}): SemanticPatchOperation { return typedAddOperation(input, nodeType, guiClass, { name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true, ...extraFields }); }
function addUserVariablesOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "Arguments", "ArgumentsPanel", { name: optionalString(input, "name") ?? "User Defined Variables", enabled: optionalBoolean(input, "enabled") ?? true, "Arguments.arguments": jsonField(input.variables ?? {}) }); }
function addCsvDataSetOperation(input: ToolCallInput): SemanticPatchOperation { const fields: Record<string, unknown> = { name: optionalString(input, "name") ?? "CSV Data Set Config", enabled: optionalBoolean(input, "enabled") ?? true, filename: requiredString(input, "filename") }; setIfPresent(fields, "variableNames", Array.isArray(input.variableNames) ? input.variableNames.join(",") : undefined); setIfPresent(fields, "delimiter", optionalString(input, "delimiter") ?? ","); setIfPresent(fields, "ignoreFirstLine", optionalBoolean(input, "ignoreFirstLine")); setIfPresent(fields, "recycle", optionalBoolean(input, "recycle")); setIfPresent(fields, "stopThread", optionalBoolean(input, "stopThread")); setIfPresent(fields, "shareMode", optionalString(input, "shareMode")); return typedAddOperation(input, "CSVDataSet", "TestBeanGUI", fields); }
function addCounterOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "CounterConfig", "CounterConfigGui", compactFields({ name: optionalString(input, "name") ?? "Counter", enabled: optionalBoolean(input, "enabled") ?? true, "CounterConfig.name": requiredString(input, "variableName"), "CounterConfig.start": optionalScalar(input, "start") ?? 1, "CounterConfig.end": optionalScalar(input, "end"), "CounterConfig.incr": optionalScalar(input, "increment") ?? 1, "CounterConfig.format": optionalString(input, "format"), "CounterConfig.per_user": optionalBoolean(input, "perUser"), "CounterConfig.reset_on_tg_iteration": optionalBoolean(input, "resetOnThreadGroupIteration") })); }
function addRandomVariableOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "RandomVariableConfig", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "Random Variable", enabled: optionalBoolean(input, "enabled") ?? true, variableName: requiredString(input, "variableName"), minimumValue: optionalScalar(input, "minimumValue") ?? 1, maximumValue: optionalScalar(input, "maximumValue") ?? 100, outputFormat: optionalString(input, "outputFormat"), perThread: optionalBoolean(input, "perThread") })); }
function addJdbcDataSourceOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JDBCDataSource", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "JDBC Connection Configuration", enabled: optionalBoolean(input, "enabled") ?? true, dataSource: requiredString(input, "dataSource"), dbUrl: optionalString(input, "dbUrl"), driver: optionalString(input, "driver"), username: optionalString(input, "username"), password: optionalString(input, "password") })); }
function addJdbcSamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JDBCSampler", "TestBeanGUI", jdbcFields(input, "JDBC Request")); }
function addFtpSamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "FTPSampler", "FtpTestSamplerGui", compactFields({ name: optionalString(input, "name") ?? "FTP Request", enabled: optionalBoolean(input, "enabled") ?? true, "FTPSampler.server": requiredString(input, "server"), "FTPSampler.remoteFile": requiredString(input, "remoteFile"), "FTPSampler.localFile": optionalString(input, "localFile"), "FTPSampler.action": optionalString(input, "action") ?? "get", "FTPSampler.binaryMode": optionalBoolean(input, "binaryMode") })); }
function addTcpSamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "TCPSampler", "TCPSamplerGui", compactFields({ name: optionalString(input, "name") ?? "TCP Sampler", enabled: optionalBoolean(input, "enabled") ?? true, "TCPSampler.server": requiredString(input, "server"), "TCPSampler.port": optionalScalar(input, "port"), "TCPSampler.text": optionalString(input, "text"), "TCPSampler.classname": optionalString(input, "classname"), "TCPSampler.timeout": optionalScalar(input, "timeout") })); }
function addJmsSamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JMSSampler", "JmsSamplerGui", compactFields({ name: optionalString(input, "name") ?? "JMS Sampler", enabled: optionalBoolean(input, "enabled") ?? true, "JMSSampler.destination": requiredString(input, "destination"), "JMSSampler.message": optionalString(input, "message"), "JMSSampler.providerUrl": optionalString(input, "providerUrl") })); }
function addSmtpSamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "SmtpSampler", "SmtpSamplerGui", compactFields({ name: optionalString(input, "name") ?? "SMTP Sampler", enabled: optionalBoolean(input, "enabled") ?? true, "SMTPSampler.server": requiredString(input, "server"), "SMTPSampler.receiver": requiredString(input, "recipient"), "SMTPSampler.sender": optionalString(input, "sender"), "SMTPSampler.subject": optionalString(input, "subject"), "SMTPSampler.message": optionalString(input, "body") })); }
function addJsr223SamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JSR223Sampler", "TestBeanGUI", jsr223Fields(input, "JSR223 Sampler")); }
function addDebugSamplerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "DebugSampler", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "Debug Sampler", enabled: optionalBoolean(input, "enabled") ?? true, displayJMeterVariables: optionalBoolean(input, "displayJMeterVariables") ?? true, displayJMeterProperties: optionalBoolean(input, "displayJMeterProperties") ?? false, displaySystemProperties: optionalBoolean(input, "displaySystemProperties") ?? false })); }
function addConstantTimerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "ConstantTimer", "ConstantTimerGui", compactFields({ name: optionalString(input, "name") ?? "Constant Timer", enabled: optionalBoolean(input, "enabled") ?? true, "ConstantTimer.delay": optionalScalar(input, "delayMs") ?? 300 })); }
function addRandomTimerOperation(input: ToolCallInput): SemanticPatchOperation { const distribution = optionalString(input, "distribution") ?? "uniform"; const timer = distribution === "gaussian" ? { type: "GaussianRandomTimer", gui: "GaussianRandomTimerGui", name: "Gaussian Random Timer" } : distribution === "poisson" ? { type: "PoissonRandomTimer", gui: "PoissonRandomTimerGui", name: "Poisson Random Timer" } : { type: "UniformRandomTimer", gui: "UniformRandomTimerGui", name: "Uniform Random Timer" }; return typedAddOperation(input, timer.type, timer.gui, compactFields({ name: optionalString(input, "name") ?? timer.name, enabled: optionalBoolean(input, "enabled") ?? true, "ConstantTimer.delay": optionalScalar(input, "delayMs") ?? 300, "RandomTimer.range": optionalScalar(input, "rangeMs"), "RandomTimer.deviation": optionalScalar(input, "deviationMs"), "RandomTimer.lambda": optionalScalar(input, "lambdaMs") })); }
function addSyncTimerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "SyncTimer", "SyncTimerGui", compactFields({ name: optionalString(input, "name") ?? "Synchronizing Timer", enabled: optionalBoolean(input, "enabled") ?? true, groupSize: optionalScalar(input, "groupSize"), timeoutInMs: optionalScalar(input, "timeoutMs") ?? 0 })); }
function addThroughputTimerOperation(input: ToolCallInput): SemanticPatchOperation { if (optionalBoolean(input, "precise") === true) return typedAddOperation(input, "PreciseThroughputTimer", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "Precise Throughput Timer", enabled: optionalBoolean(input, "enabled") ?? true, throughput: optionalScalar(input, "targetThroughput"), throughputPeriod: optionalScalar(input, "throughputPeriod") ?? 60, duration: optionalScalar(input, "durationSeconds"), batchSize: optionalScalar(input, "batchSize"), batchThreadDelay: optionalScalar(input, "batchThreadDelay") })); return typedAddOperation(input, "ConstantThroughputTimer", "TestBeanGUI", compactFields({ name: optionalString(input, "name") ?? "Constant Throughput Timer", enabled: optionalBoolean(input, "enabled") ?? true, throughput: optionalScalar(input, "targetThroughput"), calcMode: optionalScalar(input, "calcMode") ?? 1 })); }
function addJsr223TimerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JSR223Timer", "TestBeanGUI", jsr223Fields(input, "JSR223 Timer")); }
function addResponseAssertionOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "ResponseAssertion", "AssertionGui", compactFields({ name: optionalString(input, "name") ?? "Response Assertion", enabled: optionalBoolean(input, "enabled") ?? true, "Assertion.test_field": optionalString(input, "field") ?? "Assertion.response_data", "Assertion.test_type": responseAssertionType(optionalString(input, "matchType") ?? "contains"), "Assertion.test_strings": jsonField(patternsInput(input)), "Assertion.invert": optionalBoolean(input, "invert") })); }
function addJsonAssertionOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JSONPathAssertion", "JSONPathAssertionGui", compactFields({ name: optionalString(input, "name") ?? "JSON Assertion", enabled: optionalBoolean(input, "enabled") ?? true, JSON_PATH: requiredString(input, "jsonPath"), EXPECTED_VALUE: optionalString(input, "expectedValue"), JSONVALIDATION: optionalBoolean(input, "validateJson") ?? true, EXPECT_NULL: optionalBoolean(input, "expectNull") ?? false, INVERT: optionalBoolean(input, "invert") ?? false, ISREGEX: optionalBoolean(input, "regex") ?? true })); }
function addXPathAssertionOperation(input: ToolCallInput): SemanticPatchOperation { const xpath2 = optionalBoolean(input, "xpath2") ?? false; return typedAddOperation(input, xpath2 ? "XPath2Assertion" : "XPathAssertion", xpath2 ? "XPath2Panel" : "XPathAssertionGui", compactFields({ name: optionalString(input, "name") ?? "XPath Assertion", enabled: optionalBoolean(input, "enabled") ?? true, "XPath.xpath": requiredString(input, "xpath"), "XPath.validate": optionalBoolean(input, "validateXml") ?? false, "XPath.whitespace": optionalBoolean(input, "whitespace") ?? false, "XPath.tolerant": optionalBoolean(input, "tolerant") ?? false, "XPath.negate": optionalBoolean(input, "invert") ?? false })); }
function addDurationAssertionOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "DurationAssertion", "DurationAssertionGui", compactFields({ name: optionalString(input, "name") ?? "Duration Assertion", enabled: optionalBoolean(input, "enabled") ?? true, "DurationAssertion.duration": optionalScalar(input, "durationMs") })); }
function addSizeAssertionOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "SizeAssertion", "SizeAssertionGui", compactFields({ name: optionalString(input, "name") ?? "Size Assertion", enabled: optionalBoolean(input, "enabled") ?? true, "SizeAssertion.size": optionalScalar(input, "sizeBytes"), "SizeAssertion.operator": optionalString(input, "operator") ?? "=" })); }
function addJsr223AssertionOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JSR223Assertion", "TestBeanGUI", jsr223Fields(input, "JSR223 Assertion")); }
function addRegexExtractorOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "RegexExtractor", "RegexExtractorGui", compactFields({ name: optionalString(input, "name") ?? "Regular Expression Extractor", enabled: optionalBoolean(input, "enabled") ?? true, "RegexExtractor.refname": requiredString(input, "variableName"), "RegexExtractor.regex": requiredString(input, "regex"), "RegexExtractor.template": optionalString(input, "template") ?? "$1$", "RegexExtractor.default": optionalString(input, "defaultValue"), "RegexExtractor.match_number": optionalScalar(input, "matchNumber") ?? 1, "RegexExtractor.useHeaders": optionalString(input, "source") })); }
function addJsonExtractorOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JSONPostProcessor", "JSONPostProcessorGui", compactFields({ name: optionalString(input, "name") ?? "JSON Extractor", enabled: optionalBoolean(input, "enabled") ?? true, "JSONPostProcessor.referenceNames": requiredString(input, "variableName"), "JSONPostProcessor.jsonPathExprs": requiredString(input, "jsonPath"), "JSONPostProcessor.match_numbers": optionalScalar(input, "matchNumber") ?? 1, "JSONPostProcessor.defaultValues": optionalString(input, "defaultValue"), "JSONPostProcessor.compute_concat": optionalBoolean(input, "concat") ?? false })); }
function addBoundaryExtractorOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "BoundaryExtractor", "BoundaryExtractorGui", compactFields({ name: optionalString(input, "name") ?? "Boundary Extractor", enabled: optionalBoolean(input, "enabled") ?? true, "BoundaryExtractor.refname": requiredString(input, "variableName"), "BoundaryExtractor.lboundary": requiredString(input, "leftBoundary"), "BoundaryExtractor.rboundary": requiredString(input, "rightBoundary"), "BoundaryExtractor.default": optionalString(input, "defaultValue"), "BoundaryExtractor.match_number": optionalScalar(input, "matchNumber") ?? 1, "BoundaryExtractor.useHeaders": optionalString(input, "source") })); }
function addXPathExtractorOperation(input: ToolCallInput): SemanticPatchOperation { const xpath2 = optionalBoolean(input, "xpath2") ?? false; return typedAddOperation(input, xpath2 ? "XPath2Extractor" : "XPathExtractor", xpath2 ? "XPath2ExtractorGui" : "XPathExtractorGui", compactFields({ name: optionalString(input, "name") ?? "XPath Extractor", enabled: optionalBoolean(input, "enabled") ?? true, "XPathExtractor.refname": requiredString(input, "variableName"), "XPathExtractor.xpathQuery": requiredString(input, "xpath"), "XPathExtractor.default": optionalString(input, "defaultValue"), "XPathExtractor.matchNumber": optionalScalar(input, "matchNumber") ?? 1, "XPathExtractor.fragment": optionalBoolean(input, "fragment") ?? false, "XPathExtractor.validate": optionalBoolean(input, "validateXml") ?? false, "XPathExtractor.whitespace": optionalBoolean(input, "whitespace") ?? false, "XPathExtractor.tolerant": optionalBoolean(input, "tolerant") ?? false })); }
function addCssExtractorOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "HtmlExtractor", "HtmlExtractorGui", compactFields({ name: optionalString(input, "name") ?? "CSS Selector Extractor", enabled: optionalBoolean(input, "enabled") ?? true, "HtmlExtractor.refname": requiredString(input, "variableName"), "HtmlExtractor.expr": requiredString(input, "selector"), "HtmlExtractor.attribute": optionalString(input, "attribute") ?? "", "HtmlExtractor.default": optionalString(input, "defaultValue"), "HtmlExtractor.match_number": optionalScalar(input, "matchNumber") ?? 1, "HtmlExtractor.extractor_impl": optionalString(input, "implementation") ?? "CSS" })); }
function addJsr223ProcessorOperation(input: ToolCallInput, nodeType: string, defaultName: string): SemanticPatchOperation { return typedAddOperation(input, nodeType, "TestBeanGUI", jsr223Fields(input, defaultName)); }
function addJdbcPreProcessorOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "JDBCPreProcessor", "TestBeanGUI", jdbcFields(input, "JDBC PreProcessor")); }
function addUserParametersOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "UserParameters", "UserParametersGui", compactFields({ name: optionalString(input, "name") ?? "User Parameters", enabled: optionalBoolean(input, "enabled") ?? true, "UserParameters.names": jsonField(input.variables ?? {}), "UserParameters.per_iteration": optionalBoolean(input, "perIteration") ?? false })); }
function addUrlRewritingModifierOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "URLRewritingModifier", "URLRewritingModifierGui", compactFields({ name: optionalString(input, "name") ?? "HTTP URL Re-writing Modifier", enabled: optionalBoolean(input, "enabled") ?? true, argument_name: requiredString(input, "argumentName"), path_extension: optionalBoolean(input, "pathExtension") ?? false, encode: optionalBoolean(input, "encode") ?? true, cache_value: optionalBoolean(input, "cacheValue") ?? true })); }
function addResultCollectorOperation(input: ToolCallInput, nodeType: string, guiClass: string, defaultName: string): SemanticPatchOperation { return typedAddOperation(input, nodeType, guiClass, compactFields({ name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true, filename: optionalString(input, "filename"), "ResultCollector.error_logging": false, saveConfig: jsonField(input.saveConfig ?? defaultSaveConfig()) })); }
function addBackendListenerOperation(input: ToolCallInput): SemanticPatchOperation { return typedAddOperation(input, "BackendListener", "BackendListenerGui", compactFields({ name: optionalString(input, "name") ?? "Backend Listener", enabled: optionalBoolean(input, "enabled") ?? true, classname: requiredString(input, "classname"), queueSize: optionalScalar(input, "queueSize") ?? 5000, arguments: jsonField(input.arguments ?? {}) })); }
function jdbcFields(input: ToolCallInput, defaultName: string): Record<string, unknown> { return compactFields({ name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true, dataSource: requiredString(input, "dataSource"), query: requiredString(input, "query"), queryType: optionalString(input, "queryType") ?? "Select Statement", queryArguments: optionalString(input, "parameters"), variableNames: Array.isArray(input.variableNames) ? input.variableNames.join(",") : undefined, resultVariable: optionalString(input, "resultVariable") }); }
function jsr223Fields(input: ToolCallInput, defaultName: string): Record<string, unknown> { return compactFields({ name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true, scriptLanguage: optionalString(input, "language") ?? "groovy", script: optionalString(input, "script"), filename: optionalString(input, "filename"), parameters: optionalString(input, "parameters"), cacheKey: optionalString(input, "cacheKey") }); }
function httpTargetFields(input: ToolCallInput, defaultName: string): Record<string, unknown> { const fields: Record<string, unknown> = { name: optionalString(input, "name") ?? defaultName, enabled: optionalBoolean(input, "enabled") ?? true }; setIfPresent(fields, "HTTPSampler.protocol", optionalString(input, "protocol")); setIfPresent(fields, "HTTPSampler.domain", optionalString(input, "domain")); setIfPresent(fields, "HTTPSampler.port", optionalScalar(input, "port")); return fields; }
function addNodeOperation(input: ToolCallInput): SemanticPatchOperation { const parentNodeId = optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "parentNodeId"); const nodeType = optionalString(input, "nodeType") ?? optionalString(input, "type") ?? requiredString(input, "nodeType"); const fields = objectInput(input, "fields"); const index = optionalNumber(input, "index"); return { op: "addNode", parentNodeId, nodeType, ...(fields ? { fields } : {}), ...(index !== undefined ? { index } : {}) }; }
function updateFieldOperation(input: ToolCallInput): SemanticPatchOperation { return { op: "updateField", nodeId: requiredString(input, "nodeId"), fieldPath: optionalString(input, "fieldPath") ?? optionalString(input, "field") ?? requiredString(input, "fieldPath"), value: input.value }; }
function deleteNodeOperation(input: ToolCallInput): SemanticPatchOperation { return { op: "deleteNode", nodeId: requiredString(input, "nodeId") }; }
function moveNodeOperation(input: ToolCallInput): SemanticPatchOperation { const toParentNodeId = optionalString(input, "toParentNodeId") ?? optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "toParentNodeId"); const index = optionalNumber(input, "index"); return { op: "moveNode", nodeId: requiredString(input, "nodeId"), toParentNodeId, ...(index !== undefined ? { index } : {}) }; }
function cloneNodeOperation(input: ToolCallInput): SemanticPatchOperation { const toParentNodeId = optionalString(input, "toParentNodeId") ?? optionalString(input, "parentNodeId") ?? optionalString(input, "parentId") ?? requiredString(input, "toParentNodeId"); const index = optionalNumber(input, "index"); return { op: "cloneNode", nodeId: requiredString(input, "nodeId"), toParentNodeId, ...(index !== undefined ? { index } : {}) }; }
function setEnabledOperation(input: ToolCallInput, enabled: boolean): SemanticPatchOperation { return { op: "setEnabled", nodeId: requiredString(input, "nodeId"), enabled }; }
function unsafePathDiagnostics(node: SemanticNode, field: string, value: unknown): Array<{ code: string; severity: "warning" | "error"; message: string; nodeId: string; jmxPath: string; fixSuggestion: string }> { if (typeof value !== "string" || value.length === 0) return []; if (value.includes("..")) return [{ code: "JMX_UNSAFE_FILE_PATH", severity: "error", message: `Field ${field} contains a path traversal segment.`, nodeId: node.nodeId, jmxPath: node.path, fixSuggestion: "Use a workspace-relative file path without '..'." }]; if (value.startsWith("~")) return [{ code: "JMX_HOME_RELATIVE_FILE_PATH", severity: "warning", message: `Field ${field} uses a home-relative path.`, nodeId: node.nodeId, jmxPath: node.path, fixSuggestion: "Use an explicit workspace-relative or absolute CI-safe path." }]; return []; }
function summarizePlanLanguage(nodes: Array<{ role: string; type: string; enabled: boolean; children?: unknown[] }>): Record<string, unknown> { const roles: Record<string, number> = {}; const types: Record<string, number> = {}; let disabled = 0; let total = 0; const visit = (node: { role: string; type: string; enabled: boolean; children?: unknown[] }): void => { total += 1; roles[node.role] = (roles[node.role] ?? 0) + 1; types[node.type] = (types[node.type] ?? 0) + 1; if (!node.enabled) disabled += 1; for (const child of node.children ?? []) visit(child as { role: string; type: string; enabled: boolean; children?: unknown[] }); }; for (const node of nodes) visit(node); return { totalNodes: total, disabledNodes: disabled, roles, types }; }
function defaultSaveConfig(): Record<string, boolean> { return { time: true, latency: true, timestamp: true, success: true, label: true, code: true, message: true, threadName: true, dataType: true, bytes: true, sentBytes: true, url: true, threadCounts: true, idleTime: true, connectTime: true }; }
function requiredString(input: ToolCallInput, key: string): string { const value = input[key]; if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is required`); return value; }
function optionalString(input: ToolCallInput, key: string): string | undefined { const value = input[key]; return typeof value === "string" && value.length > 0 ? value : undefined; }
function optionalNumber(input: ToolCallInput, key: string): number | undefined { const value = input[key]; return typeof value === "number" && Number.isInteger(value) ? value : undefined; }
function optionalInteger(input: ToolCallInput, key: string): number | undefined {
  const value = input[key];
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return undefined;
}
function optionalBoolean(input: ToolCallInput, key: string): boolean | undefined { const value = input[key]; return typeof value === "boolean" ? value : undefined; }
function optionalScalar(input: ToolCallInput, key: string): string | number | undefined { const value = input[key]; return typeof value === "string" || typeof value === "number" ? value : undefined; }
function objectInput(input: ToolCallInput, key: string): Record<string, unknown> | undefined { const value = input[key]; return isObject(value) ? value : undefined; }
function isObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function setIfPresent(target: Record<string, unknown>, key: string, value: unknown): void { if (value !== undefined) target[key] = value; }
function compactFields(fields: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)); }
function jsonField(value: unknown): string { return JSON.stringify(value); }
function patternsInput(input: ToolCallInput): string[] { if (Array.isArray(input.patterns)) return input.patterns.filter((pattern): pattern is string => typeof pattern === "string" && pattern.length > 0); return [requiredString(input, "pattern")]; }
function responseAssertionType(matchType: string): string { switch (matchType) { case "matches": return "1"; case "equals": return "8"; case "substring": return "16"; case "contains": default: return "2"; } }

function validatePlanLanguageDocument(document: unknown): Array<{ code: string; message: string; field?: string }> {
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return [{ code: "PLANG_SCHEMA_INVALID", message: "Plan Language document must be an object." }];
  }

  const errors: Array<{ code: string; message: string; field?: string }> = [];
  const candidate = document as Record<string, unknown>;

  if (candidate.format !== "jmxpls-plan-language") {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "format must be \"jmxpls-plan-language\".", field: "format" });
  }

  if (candidate.version !== 1) {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "version must be 1.", field: "version" });
  }

  if (typeof candidate.mode !== "string" || !PLAN_LANGUAGE_MODES.has(candidate.mode)) {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "mode must be one of outline, flow, semantic, full.", field: "mode" });
  }

  if (typeof candidate.name !== "string") {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "name must be a string.", field: "name" });
  }

  if (!Array.isArray(candidate.nodes)) {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "nodes must be an array.", field: "nodes" });
  } else {
    validatePlanLanguageNodes(candidate.nodes, "nodes", errors);
  }

  if (!Array.isArray(candidate.warnings)) {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "warnings must be an array.", field: "warnings" });
  } else if (candidate.warnings.some((warning) => typeof warning !== "string")) {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "warnings must contain only strings.", field: "warnings" });
  }

  if (candidate.detail !== undefined && (typeof candidate.detail !== "string" || !PLAN_LANGUAGE_DETAILS.has(candidate.detail))) {
    errors.push({ code: "PLANG_SCHEMA_INVALID", message: "detail must be one of compact, expanded, lossless-references, raw-linked.", field: "detail" });
  }

  return errors;
}

function validatePlanLanguageNodes(nodes: unknown[], field: string, diagnostics: Array<{ code: string; message: string; field?: string }>): void {
  for (const [index, node] of nodes.entries()) {
    validatePlanLanguageNode(node, `${field}[${index}]`, diagnostics);
  }
}

function validatePlanLanguageNode(node: unknown, path: string, diagnostics: Array<{ code: string; message: string; field?: string }>): void {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "node must be an object.", field: path });
    return;
  }

  const candidate = node as Record<string, unknown>;
  const children = candidate.children;

  if (typeof candidate.nodeId !== "string" || candidate.nodeId.length === 0) {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "nodeId must be a non-empty string.", field: `${path}.nodeId` });
  }

  if (typeof candidate.type !== "string" || candidate.type.length === 0) {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "type must be a string.", field: `${path}.type` });
  }

  if (typeof candidate.name !== "string") {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "name must be a string.", field: `${path}.name` });
  }

  if (typeof candidate.enabled !== "boolean") {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "enabled must be a boolean.", field: `${path}.enabled` });
  }

  if (typeof candidate.role !== "string" || !PLAN_LANGUAGE_ROLES.has(candidate.role)) {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "role must be a valid plan role.", field: `${path}.role` });
  }

  if (candidate.fields !== undefined && (!isObject(candidate.fields))) {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "fields must be an object when present.", field: `${path}.fields` });
  }

  if (candidate.rawRef !== undefined && typeof candidate.rawRef !== "string") {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "rawRef must be a string when present.", field: `${path}.rawRef` });
  }

  if (children !== undefined && !Array.isArray(children)) {
    diagnostics.push({ code: "PLANG_SCHEMA_INVALID", message: "children must be an array when present.", field: `${path}.children` });
  } else if (Array.isArray(children)) {
    validatePlanLanguageNodes(children as unknown[], `${path}.children`, diagnostics);
  }
}

function comparePlanLanguageDocuments(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizePlanLanguage(left)) === JSON.stringify(normalizePlanLanguage(right));
}

function normalizePlanLanguage(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizePlanLanguage);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((acc, [key, item]) => {
        acc[key] = normalizePlanLanguage(item);
        return acc;
      }, {});
  }
  return value;
}
