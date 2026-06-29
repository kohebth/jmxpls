import { readFile } from "node:fs/promises";

import { checkSla, compareJtlMetrics, computeJtlMetrics, parseJtlCsv, renderMetricsReport, type SlaThresholds } from "@jmxpls/core";

import { JmxplsRuntime as BaseRuntime, type ToolCallInput, type ToolCallResult } from "./tool-runtime.js";

export class JmxplsRuntime extends BaseRuntime {
  override async callTool(name: string, input: ToolCallInput = {}): Promise<ToolCallResult> {
    const result = await callExecutionTool(name, input);
    return result ?? super.callTool(name, input);
  }
}

async function callExecutionTool(name: string, input: ToolCallInput): Promise<ToolCallResult | undefined> {
  try {
    switch (name) {
      case "analyze_jtl": return await analyzeJtl(input);
      case "compare_jtl": return await compareJtl(input);
      case "check_sla": return await checkJtlSla(input);
      default: return undefined;
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown execution tool error" };
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

function requiredPath(input: ToolCallInput, aliases: string[]): string {
  for (const alias of aliases) {
    const value = input[alias];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  throw new Error(`one of ${aliases.join(", ")} is required`);
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
