import type { ToolRegistry } from "./registry.js";

const STRING = { type: "string", minLength: 1 };
const NUMBER = { type: "number" };
const BOOLEAN = { type: "boolean" };
const RUN_ID = { runId: STRING };

const EXECUTION_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_jmeter_environment: objectSchema({}),
  run_jmeter: objectSchema({ planPath: STRING, path: STRING, jtlPath: STRING, resultPath: STRING, jmeterExecutable: STRING, execute: BOOLEAN, timeoutMs: NUMBER }, [], { anyOf: [{ required: ["planPath"] }, { required: ["path"] }] }),
  stop_run: objectSchema(RUN_ID, ["runId"]),
  get_run_status: objectSchema(RUN_ID, ["runId"]),
  get_run_logs: objectSchema(RUN_ID, ["runId"]),
  export_run_artifacts: objectSchema(RUN_ID, ["runId"]),
  generate_html_report: objectSchema({ jtlPath: STRING, path: STRING, outputDir: STRING, reportDir: STRING, jmeterExecutable: STRING, execute: BOOLEAN, timeoutMs: NUMBER }, [], { allOf: [{ anyOf: [{ required: ["jtlPath"] }, { required: ["path"] }] }, { anyOf: [{ required: ["outputDir"] }, { required: ["reportDir"] }] }] }),
  analyze_jtl: objectSchema({ path: STRING, jtlPath: STRING, report: BOOLEAN }, [], { anyOf: [{ required: ["path"] }, { required: ["jtlPath"] }] }),
  compare_jtl: objectSchema({ leftPath: STRING, rightPath: STRING, baselinePath: STRING, candidatePath: STRING, left: STRING, right: STRING }, [], { anyOf: [{ required: ["leftPath", "rightPath"] }, { required: ["baselinePath", "candidatePath"] }, { required: ["left", "right"] }] }),
  check_sla: objectSchema({ path: STRING, jtlPath: STRING, maxErrorRate: NUMBER, maxAvgMs: NUMBER, maxP95Ms: NUMBER, minThroughput: NUMBER }, [], { anyOf: [{ required: ["path"] }, { required: ["jtlPath"] }] })
};

export function registerExecutionTools(registry: ToolRegistry): void {
  for (const [name, inputSchema] of Object.entries(EXECUTION_TOOL_SCHEMAS)) {
    registry.register({ name, description: `Execution/report tool: ${name}`, inputSchema });
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}
