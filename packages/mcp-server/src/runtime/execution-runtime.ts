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

import { JmxplsRuntime as BaseRuntime, type ToolCallInput, type ToolCallResult } from "./tool-runtime.js";

export class JmxplsRuntime extends BaseRuntime {
  private readonly runs = new RunManager();

  override async callTool(name: string, input: ToolCallInput = {}): Promise<ToolCallResult> {
    const result = await this.callExecutionTool(name, input);
    return result ?? super.callTool(name, input);
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

function compactThresholds(values: Record<keyof SlaThresholds, number | undefined>): SlaThresholds {
  const thresholds: SlaThresholds = {};
  if (values.maxErrorRate !== undefined) thresholds.maxErrorRate = values.maxErrorRate;
  if (values.maxAvgMs !== undefined) thresholds.maxAvgMs = values.maxAvgMs;
  if (values.maxP95Ms !== undefined) thresholds.maxP95Ms = values.maxP95Ms;
  if (values.minThroughput !== undefined) thresholds.minThroughput = values.minThroughput;
  return thresholds;
}
