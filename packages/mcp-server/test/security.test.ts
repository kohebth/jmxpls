import { describe, expect, it } from "vitest";
import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { AuditLog, WorkspaceGuard, redactRecord } from "../src/index.js";
import { JmxplsRuntime } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("security helpers", () => {
  it("guards workspace paths", () => {
    const guard = new WorkspaceGuard(["/workspace"]);

    expect(guard.allows("/workspace/plan.jmx")).toBe(true);
    expect(guard.allows("/etc/passwd")).toBe(false);
  });

  it("redacts secret-like records and audits actions", () => {
    const audit = new AuditLog();
    audit.record("save", "plan.jmx");

    expect(redactRecord({ password: "secret", host: "example.com" }).password).toBe("<redacted>");
    expect(redactRecord({ nested: { api_key: "abc", value: "kept" } })).toEqual({ nested: { api_key: "<redacted>", value: "kept" } });
    expect(audit.list()).toHaveLength(1);
  });

  it("rejects runtime paths outside configured workspace roots", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "jmxpls-secure-workspace-"));
    const outside = mkdtempSync(join(tmpdir(), "jmxpls-outside-workspace-"));
    const runtime = new JmxplsRuntime({ workspaceRoots: [workspace] });

    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), join(outside, "plan.jmx"));

    const opened = await runtime.callTool("open_plan", { path: join(outside, "plan.jmx") });
    expect(opened.success).toBe(false);
    expect(opened.error).toContain("outside configured workspace roots");

    const run = await runtime.callTool("run_jmeter", { planPath: join(outside, "plan.jmx"), jtlPath: join(workspace, "out.jtl") });
    expect(run.success).toBe(false);
    expect(run.error).toContain("outside configured workspace roots");
  });

  it("records mutation and run audit entries", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "jmxpls-audit-workspace-"));
    const planPath = join(workspace, "plan.jmx");
    const jtlPath = join(workspace, "results.jtl");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);
    writeFileSync(jtlPath, "elapsed,label,responseCode,success\n100,GET /,200,true\n");

    const runtime = new JmxplsRuntime({ workspaceRoots: [workspace] });
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;
    const tree = await runtime.callTool("list_tree", { planId });
    const nodeId = (tree.data as Array<{ nodeId: string }>)[0]?.nodeId;
    expect(nodeId).toBeTruthy();

    expect(await runtime.callTool("disable_node", { planId, nodeId })).toMatchObject({ success: true });
    expect(await runtime.callTool("run_jmeter", { planPath, jtlPath })).toMatchObject({ success: true });

    const audit = runtime.readResource("jmxpls://audit");
    expect(audit.success).toBe(true);
    expect((audit.data as Array<{ action: string }>).map((entry) => entry.action)).toEqual(expect.arrayContaining(["disable_node", "run_jmeter"]));
  });
});
