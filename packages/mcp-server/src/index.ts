#!/usr/bin/env node

export * from "./server.js";
export * from "./prompts/registry.js";
export * from "./resources/registry.js";
export { JmxplsRuntime } from "./runtime/execution-runtime.js";
export type { ToolCallInput, ToolCallResult } from "./runtime/tool-runtime.js";
export * from "./security/audit-log.js";
export * from "./security/redaction.js";
export * from "./security/tool-policy.js";
export * from "./security/workspace-guard.js";
export * from "./tools/registry.js";

export const serverPackageName = "@jmxpls/mcp-server";

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runStdioServer } = await import("./transports/stdio.js");
  runStdioServer();
}
