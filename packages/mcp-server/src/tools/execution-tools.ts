import type { ToolRegistry } from "./registry.js";

const EXECUTION_TOOLS = ["run_jmeter", "stop_run", "get_run_status", "get_run_logs", "export_run_artifacts", "analyze_jtl", "generate_html_report", "compare_jtl", "check_sla"];

export function registerExecutionTools(registry: ToolRegistry): void {
  for (const name of EXECUTION_TOOLS) {
    registry.register({ name, description: `Execution/report tool: ${name}`, inputSchema: { type: "object", additionalProperties: true } });
  }
}
