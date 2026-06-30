import { chmodSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    const raw = await runtime.callTool("get_raw_element", { planId, nodeId });
    expect((raw.data as { rawRef: string }).rawRef).toContain("jmxpls://raw/");
    const rawProperties = await runtime.callTool("get_raw_properties", { planId, nodeId });
    expect(rawProperties.success).toBe(true);
    const rawTemplate = await runtime.callTool("generate_raw_template", { nodeType: "kg.apc.CustomElement", guiClass: "CustomGui" });
    expect((rawTemplate.data as { fields: { guiClass: string } }).fields.guiClass).toBe("CustomGui");
    const rawPatch = await runtime.callTool("validate_raw_patch", { operations: [{ op: "updateField", nodeId, fieldPath: "name", value: "raw" }] });
    expect((rawPatch.data as { valid: boolean }).valid).toBe(true);
    const rawUpdate = await runtime.callTool("update_raw_property", { planId, nodeId, propertyPath: "name", value: "Dry Run Raw Name", dryRun: true });
    expect(rawUpdate.success).toBe(true);

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

  it("returns a configured diagnostic for path-based JMeter validation without a bridge", async () => {
    const previousJar = process.env.JMXPLS_JAVA_BRIDGE_JAR;
    delete process.env.JMXPLS_JAVA_BRIDGE_JAR;
    try {
      const runtime = new JmxplsRuntime();
      const result = await runtime.callTool("validate_with_jmeter", { path: "plan.jmx", strict: true });

      expect(result.success).toBe(true);
      expect((result.data as { jmeterBacked: boolean }).jmeterBacked).toBe(false);
      expect((result.data as { valid: boolean }).valid).toBe(false);
      expect((result.data as { diagnostics: Array<{ code: string }> }).diagnostics[0]?.code).toBe("JMX_JMETER_BRIDGE_NOT_CONFIGURED");
    } finally {
      if (previousJar === undefined) {
        delete process.env.JMXPLS_JAVA_BRIDGE_JAR;
      } else {
        process.env.JMXPLS_JAVA_BRIDGE_JAR = previousJar;
      }
    }
  });

  it("validates direct and opened JMX paths through a configured bridge process", async () => {
    const previousJar = process.env.JMXPLS_JAVA_BRIDGE_JAR;
    const previousCommand = process.env.JMXPLS_JAVA_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-bridge-"));
    const scriptPath = join(dir, "bridge-stub.mjs");
    writeFileSync(scriptPath, [
      "#!/usr/bin/env node",
      "import { createInterface } from \"node:readline\";",
      "const rl = createInterface({ input: process.stdin });",
      "rl.on(\"line\", (line) => {",
      "  const request = JSON.parse(line);",
      "  process.stdout.write(JSON.stringify({ id: request.id, success: true, data: { path: request.path, valid: true }, diagnostics: [] }) + \"\\n\");",
      "});"
    ].join("\n"));
    chmodSync(scriptPath, 0o755);

    process.env.JMXPLS_JAVA_BRIDGE_JAR = join(dir, "bridge.jar");
    process.env.JMXPLS_JAVA_COMMAND = scriptPath;
    try {
      const runtime = new JmxplsRuntime();
      const result = await runtime.callTool("validate_with_jmeter", { path: "plan.jmx", mode: "load" });

      expect(result.success).toBe(true);
      expect((result.data as { jmeterBacked: boolean }).jmeterBacked).toBe(true);
      expect((result.data as { valid: boolean }).valid).toBe(true);
      expect((result.data as { path: string }).path).toBe("plan.jmx");
      expect((result.data as { mode: string }).mode).toBe("load");

      const planPath = join(dir, "minimal.jmx");
      copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);
      const opened = await runtime.callTool("open_plan", { path: planPath });
      expect(opened.success).toBe(true);
      const planId = (opened.data as { planId: string }).planId;
      const sessionResult = await runtime.callTool("validate_with_jmeter", { planId, mode: "loadSaveReload" });

      expect(sessionResult.success).toBe(true);
      expect((sessionResult.data as { jmeterBacked: boolean }).jmeterBacked).toBe(true);
      expect((sessionResult.data as { valid: boolean }).valid).toBe(true);
      expect((sessionResult.data as { path: string }).path).toBe(planPath);
      expect((sessionResult.data as { mode: string }).mode).toBe("loadSaveReload");
    } finally {
      if (previousJar === undefined) {
        delete process.env.JMXPLS_JAVA_BRIDGE_JAR;
      } else {
        process.env.JMXPLS_JAVA_BRIDGE_JAR = previousJar;
      }
      if (previousCommand === undefined) {
        delete process.env.JMXPLS_JAVA_COMMAND;
      } else {
        process.env.JMXPLS_JAVA_COMMAND = previousCommand;
      }
    }
  });

  it("plans JMeter runs, exposes resources, and analyzes JTL files", async () => {
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

    const runList = runtime.readResource("jmxpls://runs");
    expect((runList.data as Array<{ runId: string }>).some((item) => item.runId === runId)).toBe(true);
    const logs = runtime.readResource(`jmxpls://runs/${runId}/logs`);
    expect((logs.data as { logs: string[] }).logs[0]).toContain("Prepared JMeter command");
    const artifacts = runtime.readResource(`jmxpls://runs/${runId}/artifacts`);
    expect((artifacts.data as { artifacts: string[] }).artifacts).toContain(jtlPath);

    const analysis = await runtime.callTool("analyze_jtl", { jtlPath });
    expect(analysis.success).toBe(true);
    expect((analysis.data as { metrics: { errors: number } }).metrics.errors).toBe(1);
  });

  it("serves and merges component catalogs", async () => {
    const runtime = new JmxplsRuntime();
    const loaded = await runtime.callTool("load_component_catalog");
    expect((loaded.data as { count: number }).count).toBeGreaterThan(1);

    const summary = runtime.readResource("jmxpls://catalog/summary");
    expect((summary.data as { count: number }).count).toBeGreaterThan(1);
    const typeResource = runtime.readResource("jmxpls://catalog/types/HTTPSamplerProxy");
    expect((typeResource.data as { displayName: string }).displayName).toBe("HTTP Request");

    const list = await runtime.callTool("list_component_types", { role: "sampler" });
    expect((list.data as { components: Array<{ type: string }> }).components.some((item) => item.type === "HTTPSamplerProxy")).toBe(true);

    const schema = await runtime.callTool("inspect_component_schema", { type: "HTTPSamplerProxy" });
    expect((schema.data as { displayName: string }).displayName).toBe("HTTP Request");

    const defaults = await runtime.callTool("get_component_defaults", { type: "HTTPSamplerProxy" });
    expect((defaults.data as { fields: { enabled: boolean; method: string } }).fields.enabled).toBe(true);

    const imported = await runtime.callTool("import_component_catalog", {
      catalog: {
        version: 1,
        source: "dynamic",
        components: [{ type: "PluginSampler", role: "sampler", displayName: "Plugin Sampler", xmlTags: ["PluginSampler"], testClasses: ["PluginSampler"], guiClasses: ["PluginGui"], fields: [{ name: "target", type: "string" }] }]
      }
    });
    expect(imported.success).toBe(true);
    const plugin = await runtime.callTool("inspect_component_schema", { type: "PluginSampler" });
    expect((plugin.data as { displayName: string }).displayName).toBe("Plugin Sampler");
    const pluginResource = runtime.readResource("jmxpls://catalog/types/PluginSampler");
    expect((pluginResource.data as { displayName: string }).displayName).toBe("Plugin Sampler");
  });

  it("serves and instantiates built-in templates", async () => {
    const runtime = new JmxplsRuntime();
    const templates = await runtime.callTool("list_templates");
    expect((templates.data as Array<{ name: string }>).some((template) => template.name === "http_api_baseline")).toBe(true);

    const template = await runtime.callTool("get_template", { name: "http_api_baseline" });
    expect((template.data as { patch: { operations: unknown[] } }).patch.operations).toEqual([]);

    const instantiated = await runtime.callTool("instantiate_template", { name: "http_api_baseline", dryRun: true });
    expect((instantiated.data as { patch: { dryRun: boolean } }).patch.dryRun).toBe(true);

    const alias = await runtime.callTool("create_bearer_token_flow");
    expect((alias.data as { name: string }).name).toBe("http_api_login_bearer_token");
  });
});
