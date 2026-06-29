import type { ToolRegistry } from "./registry.js";

const STRING = { type: "string", minLength: 1 };
const NUMBER = { type: "number" };
const BOOLEAN = { type: "boolean" };
const ANY_OBJECT = { type: "object", additionalProperties: true };

const EXECUTION_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  run_jmeter: ANY_OBJECT,
  stop_run: ANY_OBJECT,
  get_run_status: ANY_OBJECT,
  get_run_logs: ANY_OBJECT,
  export_run_artifacts: ANY_OBJECT,
  generate_html_report: ANY_OBJECT,
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
