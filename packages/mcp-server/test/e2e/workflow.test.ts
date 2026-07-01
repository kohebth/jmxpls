import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../../src/index.js";
import { JmxplsRuntime } from "../../src/runtime/execution-runtime.js";
import { JsonRpcMcpSession, type JsonRpcResponse } from "../../src/transports/stdio.js";

const root = resolve(import.meta.dirname, "../../../..");

describe("MCP workflow surface", () => {
  it("exposes compact inspect, mutate, validate, save, run, and analyze workflow tools", () => {
    const tools = new Set(createJmxplsServer().tools.map((tool) => tool.name));

    for (const name of ["open_plan", "summarize_plan", "get_plan_language", "apply_semantic_patch", "validate_plan", "save_plan", "run_jmeter", "analyze_jtl"]) {
      expect(tools.has(name)).toBe(true);
    }
  });

  it("opens, inspects, mutates, validates, diffs, and saves through JSON-RPC MCP calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-mcp-e2e-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const session = new JsonRpcMcpSession(createJmxplsServer(), new JmxplsRuntime());
    const rpc = (method: string, params?: Record<string, unknown>) => callRpc(session, method, params);

    expect((await rpc("initialize", { protocolVersion: "2025-06-18" })).result?.serverInfo).toEqual(expect.objectContaining({ name: "jmxpls" }));
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));

    const opened = toolData<OpenPlanResponse>(await rpc("tools/call", { name: "open_plan", arguments: { path: planPath } }));
    expect(opened.defaultResource).toMatch(/^jmxpls:\/\/plans\/.+\/plan-language\/outline$/);

    const outline = resourceData<PlanLanguageResponse>(await rpc("resources/read", { uri: opened.defaultResource }));
    expect(outline.format).toBe("jmxpls-plan-language");
    expect(JSON.stringify(outline)).not.toContain("<jmeterTestPlan");

    const tree = toolData<TreePageResponse>(await rpc("tools/call", { name: "list_tree", arguments: { planId: opened.planId, limit: 5, depth: 1 } }));
    const nodeId = tree.items[0]?.nodeId;
    expect(nodeId).toBeTruthy();

    expect(structuredData(await rpc("tools/call", { name: "disable_node", arguments: { planId: opened.planId, nodeId } })).success).toBe(true);

    const diff = resourceData<SemanticDiffResponse>(await rpc("resources/read", { uri: `jmxpls://plans/${opened.planId}/diff/semantic` }));
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: "node.enabledChanged", nodeId, after: false }));

    const validation = toolData<ValidationResponse>(await rpc("tools/call", { name: "validate_plan", arguments: { planId: opened.planId } }));
    expect(validation.valid).toBe(true);

    expect(structuredData(await rpc("tools/call", { name: "save_plan", arguments: { planId: opened.planId, backup: false } })).success).toBe(true);
    expect(readFileSync(planPath, "utf8")).toContain('enabled="false"');
  });
});

type OpenPlanResponse = { planId: string; defaultResource: string };
type PlanLanguageResponse = { format: string };
type TreePageResponse = { items: Array<{ nodeId: string }> };
type SemanticDiffResponse = { changes: Array<Record<string, unknown>> };
type ValidationResponse = { valid: boolean };

async function callRpc(session: JsonRpcMcpSession, method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
  const response = await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: method, method, ...(params ? { params } : {}) }));
  expect(Array.isArray(response)).toBe(false);
  const single = response as JsonRpcResponse | undefined;
  expect(single?.error).toBeUndefined();
  return single!;
}

function structuredData<T = { success: boolean; data?: unknown }>(response: JsonRpcResponse): T {
  return (response.result?.structuredContent as T);
}

function toolData<T>(response: JsonRpcResponse): T {
  const result = structuredData<{ success: boolean; data?: unknown }>(response);
  expect(result.success).toBe(true);
  return result.data as T;
}

function resourceData<T>(response: JsonRpcResponse): T {
  const contents = response.result?.contents as Array<{ text: string }> | undefined;
  return JSON.parse(contents?.[0]?.text ?? "null") as T;
}
