import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { JmxplsRuntime } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("JmxplsRuntime", () => {
  it("opens, reads Plan Language, patches canonical XML, validates, and saves", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-runtime-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;

    const language = await runtime.callTool("get_plan_language", { planId, mode: "outline" });
    expect(language.success).toBe(true);

    const tree = await runtime.callTool("list_tree", { planId });
    const nodeId = ((tree.data as Array<{ nodeId: string }>)[0]?.nodeId)!;
    const patched = await runtime.callTool("apply_semantic_patch", {
      planId,
      patch: { operations: [{ op: "setEnabled", nodeId, enabled: false }] }
    });
    expect(patched.success).toBe(true);

    const validation = await runtime.callTool("validate_plan", { planId });
    expect(validation.success).toBe(true);

    const saved = await runtime.callTool("save_plan", { planId, backup: false });
    expect(saved.success).toBe(true);
    expect(readFileSync(planPath, "utf8")).toContain('enabled="false"');
  });

  it("plans JMeter runs and analyzes JTL files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-exec-"));
    const planPath = join(dir, "plan.jmx");
    const jtlPath = join(dir, "results.jtl");
    writeFileSync(planPath, "<jmeterTestPlan />");
    writeFileSync(jtlPath, "elapsed,label,responseCode,success\n100,GET /,200,true\n300,POST /,500,false\n");

    const runtime = new JmxplsRuntime();
    const run = await runtime.callTool("run_jmeter", { planPath, jtlPath });
    expect(run.success).toBe(true);
    const runId = (run.data as { run: { runId: string } }).run.runId;

    const status = await runtime.callTool("get_run_status", { runId });
    expect((status.data as { artifacts: string[] }).artifacts).toContain(jtlPath);

    const analysis = await runtime.callTool("analyze_jtl", { jtlPath });
    expect(analysis.success).toBe(true);
    expect((analysis.data as { metrics: { errors: number } }).metrics.errors).toBe(1);
  });
});
