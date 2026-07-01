import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BridgeClient,
  buildJMeterCliCommand,
  checkSla,
  compareJtlMetrics,
  computeJtlMetrics,
  isAllowedJMeterArg,
  parseJtlCsv,
  parsePlanLanguage,
  renderMetricsReport,
  RunManager,
  validateWithJMeter,
  type BridgeClientOptions,
  type BridgeResponse,
  type JMeterCommand,
  type JMeterValidationMode,
  type PlanLanguageNode,
  type SlaThresholds
} from "@jmxpls/core";

import { CatalogToolRuntime } from "./catalog-runtime.js";
import { TemplateToolRuntime } from "./template-runtime.js";
import { AuditLog } from "../security/audit-log.js";
import { WorkspaceGuard } from "../security/workspace-guard.js";
import { JmxplsRuntime as BaseRuntime, type ToolCallInput, type ToolCallResult } from "./tool-runtime.js";

type RawNodeView = { nodeId: string; rawRef: string; fields: Record<string, unknown> };
type OpenPlanSummary = { planId: string; sourcePath: string };
type RuntimeOptions = {
  workspaceRoots?: string[];
};

export class JmxplsRuntime extends BaseRuntime {
  private readonly runs = new RunManager();
  private readonly catalogTools = new CatalogToolRuntime();
  private readonly templateTools = new TemplateToolRuntime();
  private readonly auditLog = new AuditLog();
  private readonly workspaceGuard: WorkspaceGuard;

  constructor(options: RuntimeOptions = {}) {
    super();
    this.workspaceGuard = new WorkspaceGuard(options.workspaceRoots ?? workspaceRootsFromEnv());
  }

  override async callTool(name: string, input: ToolCallInput = {}): Promise<ToolCallResult> {
    const pathError = this.validateToolPaths(name, input);
    if (pathError) return pathError;

    const executionResult = await this.callExecutionTool(name, input);
    if (executionResult) return this.auditResult(name, input, executionResult);
    const rawResult = await this.callRawTool(name, input);
    if (rawResult) return this.auditResult(name, input, rawResult);
    const bridgeValidationResult = await this.callBridgeValidationTool(name, input);
    if (bridgeValidationResult) return bridgeValidationResult;
    const planLanguageValidationResult = await this.callPlanLanguageValidationTool(name, input);
    if (planLanguageValidationResult) return planLanguageValidationResult;
    const catalogResult = await this.catalogTools.callTool(name, input);
    if (catalogResult) return catalogResult;
    const templateResult = await this.templateTools.callTool(name, input, this);
    if (templateResult) return this.auditResult(name, input, templateResult);
    return this.auditResult(name, input, await super.callTool(name, input));
  }

  override readResource(uri: string): ToolCallResult {
    const catalogResult = this.catalogTools.readResource(uri);
    if (catalogResult) {
      return catalogResult;
    }
    if (uri === "jmxpls://runs") {
      return { success: true, data: this.runs.list() };
    }
    if (uri === "jmxpls://audit") {
      return { success: true, data: this.auditLog.list() };
    }
    const match = /^jmxpls:\/\/runs\/([^/]+)(?:\/(logs|artifacts))?$/.exec(uri);
    if (!match) {
      return super.readResource(uri);
    }
    const [, runId = "", suffix] = match;
    const run = this.runs.get(runId);
    if (!run) {
      return { success: false, error: `Unknown runId: ${runId}` };
    }
    if (suffix === "logs") {
      return { success: true, data: { runId, logs: run.logs } };
    }
    if (suffix === "artifacts") {
      return { success: true, data: { runId, artifacts: run.artifacts } };
    }
    return { success: true, data: run };
  }

  private async callExecutionTool(name: string, input: ToolCallInput): Promise<ToolCallResult | undefined> {
    try {
      switch (name) {
        case "get_jmeter_environment": return await this.getJMeterEnvironment();
        case "run_jmeter": return await this.runJMeter(input);
        case "stop_run": return this.stopRun(input);
        case "get_run_status": return this.getRunStatus(input);
        case "get_run_logs": return this.getRunLogs(input);
        case "export_run_artifacts": return this.exportRunArtifacts(input);
        case "generate_html_report": return await this.generateHtmlReport(input);
        case "analyze_jtl": return await analyzeJtl(input);
        case "compare_jtl": return await compareJtl(input);
        case "check_sla": return await checkJtlSla(input);
        default: return undefined;
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown execution tool error" };
    }
  }

  private async callRawTool(name: string, input: ToolCallInput): Promise<ToolCallResult | undefined> {
    try {
      switch (name) {
        case "get_raw_element": return await this.getRawElement(input);
        case "get_raw_properties": return await this.getRawProperties(input);
        case "add_raw_element": return await super.callTool("add_node", rawAddInput(input));
        case "update_raw_property": return await super.callTool("update_node_field", rawUpdateInput(input));
        case "replace_raw_element": return await this.replaceRawElement(input);
        case "validate_raw_patch": return validateRawPatch(input);
        case "generate_raw_template": return generateRawTemplate(input);
        default: return undefined;
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown raw tool error" };
    }
  }

  private async callPlanLanguageValidationTool(name: string, input: ToolCallInput): Promise<ToolCallResult | undefined> {
    if (name !== "validate_plan_language") {
      return undefined;
    }

    const result = await super.callTool(name, input);
    if (!result.success || !isObject(result.data) || result.data.valid !== true) {
      return result;
    }

    const parsed = parsePlanLanguage(requiredString(input, "text"));
    const diagnostics = this.catalogDiagnostics(parsed.document.nodes);
    return {
      success: true,
      data: {
        ...result.data,
        valid: diagnostics.length === 0,
        diagnostics
      }
    };
  }

  private catalogDiagnostics(nodes: PlanLanguageNode[], path = "nodes"): Array<{ code: string; message: string; field: string }> {
    return nodes.flatMap((node, index) => {
      const nodePath = `${path}[${index}]`;
      const current = this.catalogTools.hasType(node.type) ? [] : [{
        code: "PLANG_CATALOG_UNKNOWN_TYPE",
        message: `type ${node.type} is not present in the active component catalog.`,
        field: `${nodePath}.type`
      }];
      return [...current, ...this.catalogDiagnostics(node.children ?? [], `${nodePath}.children`)];
    });
  }

  private async callBridgeValidationTool(name: string, input: ToolCallInput): Promise<ToolCallResult | undefined> {
    if (name !== "validate_with_jmeter" && name !== "roundtrip_validate") {
      return undefined;
    }

    const mode = name === "roundtrip_validate" ? "loadSaveReload" : validationMode(input);
    const options = bridgeOptionsFromEnv();
    let path = optionalPath(input, ["path", "planPath", "jmxPath"]);
    if (!path && options) {
      path = await this.sourcePathForPlan(input);
    }
    if (!path) {
      return undefined;
    }
    if (!options) {
      return bridgeNotConfigured(path, mode, input.strict === true);
    }

    const bridge = new BridgeClient(options);
    try {
      if (name === "roundtrip_validate") {
        const response = await bridge.roundTripJmx(path);
        return { success: true, data: bridgeResponseData(path, mode, response) };
      }
      const result = await validateWithJMeter(bridge, { path, mode });
      return { success: true, data: { path, mode: result.mode, jmeterBacked: true, valid: result.valid, diagnostics: result.diagnostics } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown JMeter bridge validation error" };
    } finally {
      bridge.close();
    }
  }

  private async getJMeterEnvironment(): Promise<ToolCallResult> {
    const options = bridgeOptionsFromEnv();
    if (!options) {
      return bridgeEnvironmentNotConfigured();
    }

    const bridge = new BridgeClient(options);
    try {
      const response = await bridge.environment();
      return { success: true, data: { bridgeConfigured: true, valid: response.success, environment: response.data ?? null, diagnostics: response.diagnostics } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown JMeter bridge environment error" };
    } finally {
      bridge.close();
    }
  }

  private async sourcePathForPlan(input: ToolCallInput): Promise<string | undefined> {
    const planId = optionalString(input, "planId");
    if (!planId) {
      return undefined;
    }
    const result = await super.callTool("list_open_plans");
    if (!result.success || !Array.isArray(result.data)) {
      return undefined;
    }
    return result.data.find((item): item is OpenPlanSummary => isOpenPlanSummary(item) && item.planId === planId)?.sourcePath;
  }

  private async getRawElement(input: ToolCallInput): Promise<ToolCallResult> {
    const result = await super.callTool("get_node", { planId: requiredString(input, "planId"), nodeId: requiredString(input, "nodeId") });
    if (!result.success || !isRawNodeView(result.data)) {
      return result.success ? { success: false, error: "Node was not found or is not a semantic node." } : result;
    }
    return { success: true, data: result.data };
  }

  private async getRawProperties(input: ToolCallInput): Promise<ToolCallResult> {
    const result = await this.getRawElement(input);
    if (!result.success || !isRawNodeView(result.data)) {
      return result;
    }
    return { success: true, data: { nodeId: result.data.nodeId, rawRef: result.data.rawRef, fields: result.data.fields } };
  }

  private async replaceRawElement(input: ToolCallInput): Promise<ToolCallResult> {
    const nodeId = requiredString(input, "nodeId");
    const fields = objectInput(input, "fields");
    const operations = Object.entries(fields).map(([fieldPath, value]) => ({ op: "updateField", nodeId, fieldPath, value }));
    return await super.callTool("apply_semantic_patch", { planId: requiredString(input, "planId"), operations, ...patchFlags(input) });
  }

  private async runJMeter(input: ToolCallInput): Promise<ToolCallResult> {
    const planPath = requiredPath(input, ["planPath", "path"]);
    const jtlPath = optionalPath(input, ["jtlPath", "resultPath"]) ?? `${planPath}.jtl`;
    const command = buildJMeterCliCommand(planPath, jtlPath, optionalString(input, "jmeterExecutable") ?? "jmeter");
    assertAllowedCommand(command);
    const run = this.runs.create({ command, artifacts: [jtlPath], logs: [`Prepared JMeter command: ${command.executable} ${command.args.join(" ")}`] });
    if (input.execute !== true) {
      return { success: true, data: { run, command, executionMode: "planned", nextSuggestedResources: runSuggestedResources(run.runId) } };
    }

    this.runs.setStatus(run.runId, "running");
    const result = await executeCommand(command, optionalNumber(input, "timeoutMs"));
    this.runs.setProcessResult(run.runId, result);
    appendProcessLogs(this.runs, run.runId, result);
    this.runs.setStatus(run.runId, result.exitCode === 0 ? "completed" : "failed");
    return { success: true, data: { run: this.runs.get(run.runId), command, executionMode: "executed", exitCode: result.exitCode, nextSuggestedResources: runSuggestedResources(run.runId) } };
  }

  private stopRun(input: ToolCallInput): ToolCallResult {
    const runId = requiredString(input, "runId");
    const stopped = this.runs.stop(runId);
    return stopped ? { success: true, data: this.runs.get(runId) } : { success: false, error: `Unknown runId: ${runId}` };
  }

  private getRunStatus(input: ToolCallInput): ToolCallResult {
    const runId = requiredString(input, "runId");
    const run = this.runs.get(runId);
    return run ? { success: true, data: run } : { success: false, error: `Unknown runId: ${runId}` };
  }

  private getRunLogs(input: ToolCallInput): ToolCallResult {
    const runId = requiredString(input, "runId");
    const run = this.runs.get(runId);
    return run ? { success: true, data: { runId, logs: run.logs } } : { success: false, error: `Unknown runId: ${runId}` };
  }

  private exportRunArtifacts(input: ToolCallInput): ToolCallResult {
    const runId = requiredString(input, "runId");
    const run = this.runs.get(runId);
    return run ? { success: true, data: { runId, artifacts: run.artifacts } } : { success: false, error: `Unknown runId: ${runId}` };
  }

  private async generateHtmlReport(input: ToolCallInput): Promise<ToolCallResult> {
    const jtlPath = requiredPath(input, ["jtlPath", "path"]);
    const outputDir = requiredPath(input, ["outputDir", "reportDir"]);
    const executable = optionalString(input, "jmeterExecutable") ?? "jmeter";
    const command = { executable, args: ["-g", jtlPath, "-o", outputDir] };
    assertAllowedCommand(command);
    const run = this.runs.create({ command, artifacts: [outputDir], logs: [`Prepared JMeter report command: ${command.executable} ${command.args.join(" ")}`] });
    if (input.execute !== true) {
      return { success: true, data: { run, command, executionMode: "planned", nextSuggestedResources: runSuggestedResources(run.runId) } };
    }

    this.runs.setStatus(run.runId, "running");
    const result = await executeCommand(command, optionalNumber(input, "timeoutMs"));
    this.runs.setProcessResult(run.runId, result);
    appendProcessLogs(this.runs, run.runId, result);
    const indexPath = join(outputDir, "index.html");
    if (result.exitCode === 0 && existsSync(indexPath)) {
      this.runs.addArtifact(run.runId, indexPath);
    }
    this.runs.setStatus(run.runId, result.exitCode === 0 ? "completed" : "failed");
    return { success: true, data: { run: this.runs.get(run.runId), command, executionMode: "executed", exitCode: result.exitCode, nextSuggestedResources: runSuggestedResources(run.runId) } };
  }

  private validateToolPaths(name: string, input: ToolCallInput): ToolCallResult | undefined {
    for (const key of pathKeysForTool(name)) {
      const value = input[key];
      if (typeof value === "string" && value.length > 0 && !this.workspaceGuard.allows(value)) {
        return { success: false, error: `Path for ${key} is outside configured workspace roots: ${value}` };
      }
    }
    return undefined;
  }

  private auditResult(name: string, input: ToolCallInput, result: ToolCallResult): ToolCallResult {
    if (result.success && AUDITED_TOOLS.has(name)) {
      this.auditLog.record(name, auditTarget(input, result));
    }
    return result;
  }
}

const AUDITED_TOOLS = new Set([
  "add_node",
  "update_node_field",
  "delete_node",
  "move_node",
  "clone_node",
  "enable_node",
  "disable_node",
  "apply_semantic_patch",
  "add_raw_element",
  "update_raw_property",
  "replace_raw_element",
  "save_plan",
  "save_plan_as",
  "run_jmeter",
  "generate_html_report"
]);

const TOOL_PATH_KEYS: Record<string, string[]> = {
  open_plan: ["path"],
  save_plan: ["path"],
  save_plan_as: ["path"],
  import_plan_language: ["path", "targetPath"],
  apply_plan_language: ["path"],
  import_component_catalog: ["path"],
  validate_with_jmeter: ["path", "planPath", "jmxPath"],
  roundtrip_validate: ["path", "planPath", "jmxPath"],
  run_jmeter: ["planPath", "path", "jtlPath", "resultPath"],
  generate_html_report: ["jtlPath", "path", "outputDir", "reportDir"],
  analyze_jtl: ["path", "jtlPath"],
  compare_jtl: ["leftPath", "baselinePath", "left", "rightPath", "candidatePath", "right"],
  check_sla: ["path", "jtlPath"]
};

function pathKeysForTool(name: string): string[] {
  return TOOL_PATH_KEYS[name] ?? [];
}

function auditTarget(input: ToolCallInput, result: ToolCallResult): string | undefined {
  for (const key of ["planId", "runId", "path", "planPath", "jtlPath"]) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  if (isObject(result.data) && typeof result.data.planId === "string") return result.data.planId;
  return undefined;
}

async function analyzeJtl(input: ToolCallInput): Promise<ToolCallResult> {
  const path = requiredPath(input, ["path", "jtlPath"]);
  const samples = parseJtlCsv(await readFile(path, "utf8"));
  const metrics = computeJtlMetrics(samples);
  return { success: true, data: { path, samples: samples.length, metrics, report: renderMetricsReport(metrics) } };
}

async function compareJtl(input: ToolCallInput): Promise<ToolCallResult> {
  const leftPath = requiredPath(input, ["leftPath", "baselinePath", "left"]);
  const rightPath = requiredPath(input, ["rightPath", "candidatePath", "right"]);
  const left = parseJtlCsv(await readFile(leftPath, "utf8"));
  const right = parseJtlCsv(await readFile(rightPath, "utf8"));
  return { success: true, data: { leftPath, rightPath, comparison: compareJtlMetrics(left, right) } };
}

async function checkJtlSla(input: ToolCallInput): Promise<ToolCallResult> {
  const path = requiredPath(input, ["path", "jtlPath"]);
  const samples = parseJtlCsv(await readFile(path, "utf8"));
  const thresholds = compactThresholds({
    maxErrorRate: optionalNumber(input, "maxErrorRate"),
    maxAvgMs: optionalNumber(input, "maxAvgMs"),
    maxP95Ms: optionalNumber(input, "maxP95Ms"),
    minThroughput: optionalNumber(input, "minThroughput")
  });
  return { success: true, data: { path, thresholds, result: checkSla(samples, thresholds) } };
}

function bridgeOptionsFromEnv(): BridgeClientOptions | undefined {
  const jarPath = process.env.JMXPLS_JAVA_BRIDGE_JAR ?? bundledBridgeJarPath();
  if (!jarPath) {
    return undefined;
  }
  const timeoutMs = process.env.JMXPLS_JAVA_BRIDGE_TIMEOUT_MS ? Number(process.env.JMXPLS_JAVA_BRIDGE_TIMEOUT_MS) : undefined;
  return {
    jarPath,
    ...(process.env.JMXPLS_JAVA_COMMAND ? { javaCommand: process.env.JMXPLS_JAVA_COMMAND } : {}),
    ...(timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {})
  };
}

function bundledBridgeJarPath(): string | undefined {
  const runtimeDir = dirname(fileURLToPath(import.meta.url));
  const candidate = join(runtimeDir, "../../java-bridge/jmxpls-java-bridge.jar");
  return existsSync(candidate) ? candidate : undefined;
}

function validationMode(input: ToolCallInput): JMeterValidationMode {
  const mode = optionalString(input, "mode");
  if (mode === "load" || mode === "loadSave" || mode === "loadSaveReload") {
    return mode;
  }
  return "loadSaveReload";
}

function bridgeNotConfigured(path: string, mode: JMeterValidationMode, strict: boolean): ToolCallResult {
  const severity = strict ? "error" : "warning";
  const diagnostics = [{
    code: "JMX_JMETER_BRIDGE_NOT_CONFIGURED",
    severity,
    message: "JMeter bridge validation is not configured in this runtime yet; returned bridge validation fallback.",
    fixSuggestion: "Set JMXPLS_JAVA_BRIDGE_JAR to the Java bridge executable jar before using path-based JMeter validation."
  }];
  return { success: true, data: { path, mode, jmeterBacked: false, valid: severity !== "error", diagnostics, nextSuggestedResources: ["jmxpls://audit"] } };
}

function bridgeEnvironmentNotConfigured(): ToolCallResult {
  return {
    success: true,
    data: {
      bridgeConfigured: false,
      valid: false,
      environment: null,
      diagnostics: [{
        code: "JMX_JMETER_BRIDGE_NOT_CONFIGURED",
        severity: "warning",
        message: "JMeter bridge environment is not available because the Java bridge is not configured.",
        fixSuggestion: "Set JMXPLS_JAVA_BRIDGE_JAR to the Java bridge executable jar before probing the JMeter environment."
      }],
      nextSuggestedResources: ["jmxpls://audit"]
    }
  };
}

function runSuggestedResources(runId: string): string[] {
  return [`jmxpls://runs/${runId}`, `jmxpls://runs/${runId}/logs`, `jmxpls://runs/${runId}/artifacts`, "jmxpls://audit"];
}

function bridgeResponseData(path: string, mode: JMeterValidationMode, response: BridgeResponse<{ path: string; valid?: boolean; reason?: string }>): Record<string, unknown> {
  return {
    path,
    mode,
    jmeterBacked: true,
    valid: response.success && response.data?.valid === true,
    diagnostics: response.diagnostics,
    bridge: response.data ?? null
  };
}

function rawAddInput(input: ToolCallInput): ToolCallInput {
  return { planId: requiredString(input, "planId"), parentNodeId: optionalString(input, "parentNodeId") ?? optionalString(input, "parentId"), nodeType: optionalString(input, "nodeType") ?? optionalString(input, "type"), fields: objectInput(input, "fields"), ...patchFlags(input) };
}

function rawUpdateInput(input: ToolCallInput): ToolCallInput {
  return { planId: requiredString(input, "planId"), nodeId: requiredString(input, "nodeId"), fieldPath: optionalString(input, "propertyPath") ?? optionalString(input, "property") ?? optionalString(input, "fieldPath"), value: input.value, ...patchFlags(input) };
}

function validateRawPatch(input: ToolCallInput): ToolCallResult {
  const operations = Array.isArray(input.operations) ? input.operations : isObject(input.patch) && Array.isArray(input.patch.operations) ? input.patch.operations : [];
  const diagnostics = operations.flatMap((operation, index) => validateRawOperation(operation, index));
  return { success: true, data: { valid: diagnostics.length === 0, operationCount: operations.length, diagnostics } };
}

function validateRawOperation(operation: unknown, index: number): Array<{ code: string; severity: "error"; message: string; field?: string }> {
  if (!isObject(operation) || typeof operation.op !== "string") {
    return [{ code: "JMX_RAW_PATCH_INVALID_OPERATION", severity: "error", message: `Operation ${index} must be an object with an op string.` }];
  }

  switch (operation.op) {
    case "addNode": return requiredRawFields(operation, index, ["parentNodeId", "nodeType"]);
    case "updateField": return requiredRawFields(operation, index, ["nodeId", "fieldPath"]);
    case "deleteNode": return requiredRawFields(operation, index, ["nodeId"]);
    case "moveNode":
    case "cloneNode": return requiredRawFields(operation, index, ["nodeId", "toParentNodeId"]);
    case "setEnabled": return requiredRawFields(operation, index, ["nodeId"]).concat(typeof operation.enabled === "boolean" ? [] : rawFieldDiagnostic(index, "enabled", "enabled must be a boolean."));
    default: return [{ code: "JMX_RAW_PATCH_UNSUPPORTED_OPERATION", severity: "error", message: `Operation ${index} uses unsupported op ${operation.op}.`, field: `operations[${index}].op` }];
  }
}

function requiredRawFields(operation: Record<string, unknown>, index: number, fields: string[]): Array<{ code: string; severity: "error"; message: string; field: string }> {
  return fields.flatMap((field) => typeof operation[field] === "string" && operation[field].length > 0 ? [] : [rawFieldDiagnostic(index, field, `${field} must be a non-empty string.`)]);
}

function rawFieldDiagnostic(index: number, field: string, message: string): { code: string; severity: "error"; message: string; field: string } {
  return { code: "JMX_RAW_PATCH_INVALID_OPERATION", severity: "error", message: `Operation ${index}: ${message}`, field: `operations[${index}].${field}` };
}

function generateRawTemplate(input: ToolCallInput): ToolCallResult {
  const nodeType = optionalString(input, "nodeType") ?? optionalString(input, "type") ?? requiredString(input, "nodeType");
  const fields = { name: optionalString(input, "name") ?? nodeType, enabled: input.enabled !== false, ...(optionalString(input, "guiClass") ? { guiClass: optionalString(input, "guiClass") } : {}), ...objectInput(input, "fields") };
  return { success: true, data: { nodeType, fields } };
}

function assertAllowedCommand(command: JMeterCommand): void {
  if (!isAllowedJMeterExecutableName(command.executable)) {
    throw new Error(`Rejected unsafe JMeter executable: ${command.executable}`);
  }
  for (const arg of command.args) {
    if (!isAllowedJMeterArg(arg)) {
      throw new Error(`Rejected unsafe JMeter argument: ${arg}`);
    }
  }
}

type ProcessResult = { exitCode: number; stdout: string; stderr: string };

function executeCommand(command: JMeterCommand, timeoutMs?: number): Promise<ProcessResult> {
  return new Promise((resolve) => {
    execFile(command.executable, command.args, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      resolve({ exitCode: code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function appendProcessLogs(runs: RunManager, runId: string, result: ProcessResult): void {
  if (result.stdout) {
    runs.appendLog(runId, `stdout: ${result.stdout}`);
  }
  if (result.stderr) {
    runs.appendLog(runId, `stderr: ${result.stderr}`);
  }
  runs.appendLog(runId, `JMeter process exited with code ${result.exitCode}`);
}

function isAllowedJMeterExecutableName(executable: string): boolean {
  return isAllowedJMeterArg(executable) && ["jmeter", "jmeter.bat", "ApacheJMeter.jar"].includes(basename(executable));
}

function requiredPath(input: ToolCallInput, aliases: string[]): string {
  const value = optionalPath(input, aliases);
  if (value) {
    return value;
  }
  throw new Error(`one of ${aliases.join(", ")} is required`);
}

function optionalPath(input: ToolCallInput, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = input[alias];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
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
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectInput(input: ToolCallInput, key: string): Record<string, unknown> {
  const value = input[key];
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRawNodeView(value: unknown): value is RawNodeView {
  return isObject(value) && typeof value.nodeId === "string" && typeof value.rawRef === "string" && isObject(value.fields);
}

function isOpenPlanSummary(value: unknown): value is OpenPlanSummary {
  return isObject(value) && typeof value.planId === "string" && typeof value.sourcePath === "string";
}

function patchFlags(input: ToolCallInput): ToolCallInput {
  return { validate: true, ...(typeof input.dryRun === "boolean" ? { dryRun: input.dryRun } : {}) };
}

function compactThresholds(values: Record<keyof SlaThresholds, number | undefined>): SlaThresholds {
  const thresholds: SlaThresholds = {};
  if (values.maxErrorRate !== undefined) thresholds.maxErrorRate = values.maxErrorRate;
  if (values.maxAvgMs !== undefined) thresholds.maxAvgMs = values.maxAvgMs;
  if (values.maxP95Ms !== undefined) thresholds.maxP95Ms = values.maxP95Ms;
  if (values.minThroughput !== undefined) thresholds.minThroughput = values.minThroughput;
  return thresholds;
}

function workspaceRootsFromEnv(): string[] {
  const configured = process.env.JMXPLS_WORKSPACE_ROOTS?.split(":").filter((root) => root.length > 0);
  return configured && configured.length > 0 ? configured : [process.cwd(), tmpdir()];
}
