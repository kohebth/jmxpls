import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { JmxplsRuntime } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");
const builtInTemplateNames = [
  "http_api_baseline",
  "http_api_login_bearer_token",
  "csv_driven_login_flow",
  "constant_load_profile",
  "ramp_load_profile",
  "spike_load_profile",
  "stress_load_profile",
  "soak_load_profile"
];

describe("template runtime", () => {
  it("dry-runs built-in templates against open plans", async () => {
    const runtime = new JmxplsRuntime();

    for (const name of builtInTemplateNames) {
      const dir = mkdtempSync(join(tmpdir(), "jmxpls-template-apply-"));
      const planPath = join(dir, "minimal.jmx");
      copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

      const opened = await runtime.callTool("open_plan", { path: planPath });
      expect(opened.success).toBe(true);
      const planId = (opened.data as { planId: string }).planId;
      const result = await runtime.callTool("instantiate_template", { name, planId, apply: true, dryRun: true });

      expect(result.success).toBe(true);
      expect((result.data as { dryRun: boolean }).dryRun).toBe(true);
      expect((result.data as { semantic: { root: Array<{ children: unknown[] }> } }).semantic.root[0]?.children).toHaveLength(1);
    }
  });
});
