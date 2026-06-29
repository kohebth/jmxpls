import { readFile } from "node:fs/promises";

import {
  buildJMeterCliCommand,
  checkSla,
  compareJtlMetrics,
  computeJtlMetrics,
  isAllowedJMeterArg,
  parseJtlCsv,
  renderMetricsReport,
  RunManager,
  type JMeterCommand,
  type SlaThresholds
} from "@jmxpls/core";

import { CatalogToolRuntime } from "./catalog-runtime.js";
import { TemplateToolRuntime } from "./template-runtime.js";
import { JmxplsRuntime as BaseRuntime, type ToolCallInput, type ToolCallResult } from "./tool-runtime.js";

type RawNodeView = { nodeId: string; rawRef: string; fields: Record<string, unknown> };

export class JmxplsRuntime extends BaseRuntime {
  private readonly runs = new RunManager();
  private readonly catalogTools = new CatalogToolRuntime();
  private readonly templateTools = new TemplateToolRuntime();

  override async callTool(name: string, input: ToolCallInput = {}): Promise<ToolCallResult> {
    const executionResult = await this.callExecutionTool(name, input);
    if (executionResult) return executionResult;
    const rawResult = await this.callRawTool(name, input);
    if (rawResult) return rawResult;
    const catalogResult = await this.catalogTools.callTool(name, input);
    if (catalogResult) return catalogResult;
    const templateResult = await this.templateTools.callTool(name, input, this);
    return templateResult ?? super.callTool(name, input);
  }

  override readResource(uri: string): ToolCallResult {
    const catalogResult = this.catalogTools.readResource(uri);
    if (catalogResult) {
      return catalogResult;
    }
    if (uri === "jmxpls://runs") {
      return { success: true, data: this.runs.list() };
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
        case "run_jmeter": return this.runJMeter(input);
        case "stop_run": return this.stopRun(input);
        case "get_run_status": return this.getRunStatus(input);
        case "get_run_logs": return this.getRunLogs(input);
        case "export_run_artifacts": return this.exportRunArtifacts(input);
        case "generate_html_report": return this.generateHtmlReport(input);
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

  private runJMeter(input: ToolCallInput): ToolCallResult {
    const planPath = requiredPath(input, ["planPath", "path"]);
    const jtlPath = optionalPath(input, ["jtlPath", "resultPath"]) ?? `${planPath}.jtl`;
    const command = buildJMeterCliCommand(planPath, jtlPath, optionalString(input, "jmeterExecutable") ?? "jmeter");
    assertAllowedCommand(command);
    const run = this.runs.create({ command, artifacts: [jtlPath], logs: [`Prepared JMeter command: ${command.executable} ${command.args.join(" ")}`] });
    return { success: true, data: { run, command, executionMode: "planned" } };
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

  private generateHtmlReport(input: ToolCallInput): ToolCallResult {
    const jtlPath = requiredPath(input, ["jtlPath", "path"]);
    const outputDir = requiredPath(input, ["outputDir", "reportDir"]);
    const executable = optionalString(input, "jmeterExecutable") ?? "jmeter";
    const command = { executable, args: ["-g", jtlPath, "-o", outputDir] };
    assertAllowedCommand(command);
    const run = this.runs.create({ command, artifacts: [outputDir], logs: [`Prepared JMeter report command: ${command.executable} ${command.args.join(" ")}`] });
    return { success: true, data: { run, command, executionMode: "planned" } };
  }
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

function rawAddInput(input: ToolCallInput): ToolCallInput {
  return { planId: requiredString(input, "planId"), parentNodeId: optionalString(input, "parentNodeId") ?? optionalString(input, "parentId"), nodeType: optionalString(input, "nodeType") ?? optionalString(input, "type"), fields: objectInput(input, "fields"), ...patchFlags(input) };
}

function rawUpdateInput(input: ToolCallInput): ToolCallInput {
  return { planId: requiredString(input, "planId"), nodeId: requiredString(input, "nodeId"), fieldPath: optionalString(input, "propertyPath") ?? optionalString(input, "property") ?? optionalString(input, "fieldPath"), value: input.value, ...patchFlags(input) };
}

function validateRawPatch(input: ToolCallInput): ToolCallResult {
  const operations = Array.isArray(input.operations) ? input.operations : isObject(input.patch) && Array.isArray(input.patch.operations) ? input.patch.operations : [];
  const diagnostics = operations.flatMap((operation, index) => isObject(operation) && typeof operation.op === "string" ? [] : [{ code: "JMX_RAW_PATCH_INVALID_OPERATION", severity: "error", message: `Operation ${index} must be an object with an op string.` }]);
  return { success: true, data: { valid: diagnostics.length === 0, operationCount: operations.length, diagnostics } };
}

function generateRawTemplate(input: ToolCallInput): ToolCallResult {
  const nodeType = optionalString(input, "nodeType") ?? optionalString(input, "type") ?? requiredString(input, "nodeType");
  const fields = { name: optionalString(input, "name") ?? nodeType, enabled: input.enabled !== false, ...(optionalString(input, "guiClass") ? { guiClass: optionalString(input, "guiClass") } : {}), ...objectInput(input, "fields") };
  return { success: true, data: { nodeType, fields } };
}

function assertAllowedCommand(command: JMeterCommand): void {
  for (const arg of [command.executable, ...command.args]) {
    if (!isAllowedJMeterArg(arg)) {
      throw new Error(`Rejected unsafe JMeter argument: ${arg}`);
    }
  }
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

function patchFlags(input: ToolCallInput): ToolCallInput {
  return { ...(typeof input.dryRun === "boolean" ? { dryRun: input.dryRun } : {}), ...(typeof input.validate === "boolean" ? { validate: input.validate } : {}) };
}

function compactThresholds(values: Record<keyof SlaThresholds, number | undefined>): SlaThresholds {
  const thresholds: SlaThresholds = {};
  if (values.maxErrorRate !== undefined) thresholds.maxErrorRate = values.maxErrorRate;
  if (values.maxAvgMs !== undefined) thresholds.maxAvgMs = values.maxAvgMs;
  if (values.maxP95Ms !== undefined) thresholds.maxP95Ms = values.maxP95Ms;
  if (values.minThroughput !== undefined) thresholds.minThroughput = values.minThroughput;
  return thresholds;
}
