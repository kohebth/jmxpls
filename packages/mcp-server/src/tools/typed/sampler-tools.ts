import type { ToolRegistry } from "../registry.js";

const SAMPLER_TOOLS = ["add_jdbc_sampler", "add_ftp_sampler", "add_tcp_sampler", "add_jms_sampler", "add_smtp_sampler", "add_jsr223_sampler", "add_debug_sampler"];

export function registerSamplerTools(registry: ToolRegistry): void {
  for (const name of SAMPLER_TOOLS) {
    registry.register({ name, description: `Typed sampler tool: ${name}`, inputSchema: { type: "object", additionalProperties: true } });
  }
}
