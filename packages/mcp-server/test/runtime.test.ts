import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
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
});
