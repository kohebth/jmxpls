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
  "blank_test_plan",
  "crud_api_flow",
  "jmeter_ci_artifact_profile",
  "backend_listener_influxdb_profile",
  "jdbc_query_test",
  "jms_point_to_point_test",
  "tcp_smoke_test",
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

  it("passes parameters through template instantiation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-template-params-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;
    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = ((tree.data as Array<{ nodeId: string }>)[0]?.nodeId)!;

    const result = await runtime.callTool("instantiate_template", { name: "http_api_baseline", planId, idPrefix: "runtime-api", domain: "runtime.example", path: "/ready", threads: 7, dryRun: true });
    const patch = (result.data as { patch: { dryRun: boolean; operations: Array<{ parentNodeId?: string; nodeId?: string; fields?: Record<string, unknown> }> } }).patch;

    expect(result.success).toBe(true);
    expect(patch.dryRun).toBe(true);
    expect(patch.operations[0]).toMatchObject({ parentNodeId: rootNodeId, nodeId: "runtime-api-thread-group", fields: { "ThreadGroup.num_threads": 7 } });
    expect(patch.operations[1]?.fields).toMatchObject({ "HTTPSampler.domain": "runtime.example" });
    expect(patch.operations[2]?.fields).toMatchObject({ "HTTPSampler.path": "/ready" });
  });

  it("returns template metadata from list/get", async () => {
    const runtime = new JmxplsRuntime();

    const list = await runtime.callTool("list_templates", {});
    expect(list.success).toBe(true);

    const templates = list.data as Array<{ name: string; parameters: Array<{ name: string; type: string }> }>;
    const baseline = templates.find((template) => template.name === "http_api_baseline");
    expect(baseline).toBeTruthy();
    expect(baseline?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "domain", type: "string" }),
        expect.objectContaining({ name: "threads", type: "number" })
      ]),
    );

    const template = await runtime.callTool("get_template", { name: "http_api_login_bearer_token" });
    expect(template.success).toBe(true);

    const data = template.data as { parameters: Array<{ name: string; type: string }> };
    expect(data.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "tokenVariable", type: "string" }),
        expect.objectContaining({ name: "loginPath", type: "string" }),
        expect.objectContaining({ name: "authenticatedPath", type: "string" })
      ]),
    );
    const crudTemplate = await runtime.callTool("get_template", { name: "crud_api_flow" });
    expect(crudTemplate.success).toBe(true);

    const crudData = crudTemplate.data as { parameters: Array<{ name: string; type: string }> };
    expect(crudData.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "resourceBasePath", type: "string" }),
        expect.objectContaining({ name: "createMethod", type: "string" })
      ]),
    );
  });
});
