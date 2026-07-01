import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  it("validates Plan Language text for JSON and YAML formats", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-plan-language-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);
    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;

    const jsonText = await runtime.callTool("get_plan_language", { planId, format: "json", mode: "semantic" });
    expect(jsonText.success).toBe(true);
    const jsonValidation = await runtime.callTool("validate_plan_language", { text: jsonText.data as string });
    expect(jsonValidation.success).toBe(true);
    expect((jsonValidation.data as { valid: boolean; sourceFormat: string }).sourceFormat).toBe("json");
    expect((jsonValidation.data as { valid: boolean }).valid).toBe(true);

    const yamlText = await runtime.callTool("get_plan_language", { planId, format: "yaml", mode: "semantic" });
    expect(yamlText.success).toBe(true);
    const yamlValidation = await runtime.callTool("validate_plan_language", { text: yamlText.data as string });
    expect(yamlValidation.success).toBe(true);
    expect((yamlValidation.data as { valid: boolean; sourceFormat: string }).sourceFormat).toBe("yaml");
    expect((yamlValidation.data as { valid: boolean }).valid).toBe(true);

    const compare = await runtime.callTool("compare_plan_language", { left: jsonText.data as string, right: jsonText.data as string });
    expect(compare.success).toBe(true);
    expect((compare.data as { equivalent: boolean }).equivalent).toBe(true);

    const invalidYaml = await runtime.callTool("validate_plan_language", { text: "plan: [ " });
    expect(invalidYaml.success).toBe(false);

    const invalidSchema = await runtime.callTool("validate_plan_language", { text: "{\"format\":\"invalid\",\"version\":2,\"mode\":\"outline\",\"name\":\"x\",\"nodes\":[],\"warnings\":[]}" });
    expect(invalidSchema.success).toBe(true);
    expect((invalidSchema.data as { valid: boolean }).valid).toBe(false);
    expect((invalidSchema.data as { diagnostics: Array<{ code: string }> }).diagnostics).toContainEqual({ code: "PLANG_SCHEMA_INVALID", message: expect.any(String), field: "format" });

    const explainFailure = await runtime.callTool("explain_plan_language", { text: "{\"format\":\"invalid\",\"version\":2,\"mode\":\"outline\",\"name\":\"x\",\"nodes\":[],\"warnings\":[]}" });
    expect(explainFailure.success).toBe(false);

    const compareFailure = await runtime.callTool("compare_plan_language", { left: "{\"format\":\"invalid\",\"version\":2,\"mode\":\"outline\",\"name\":\"x\",\"nodes\":[],\"warnings\":[]}", right: "{\"format\":\"invalid\",\"version\":2,\"mode\":\"outline\",\"name\":\"x\",\"nodes\":[],\"warnings\":[]}" });
    expect(compareFailure.success).toBe(false);
  });

  it("validates Plan Language node types against the active component catalog", async () => {
    const text = JSON.stringify({
      format: "jmxpls-plan-language",
      version: 1,
      mode: "outline",
      detail: "expanded",
      name: "plugin-plan",
      nodes: [{
        nodeId: "root",
        role: "testPlan",
        type: "TestPlan",
        name: "plugin plan",
        enabled: true,
        children: [{
          nodeId: "plugin",
          role: "sampler",
          type: "PluginSampler",
          name: "plugin",
          enabled: true
        }]
      }],
      warnings: []
    });

    const runtime = new JmxplsRuntime();
    const unknown = await runtime.callTool("validate_plan_language", { text });
    expect(unknown.success).toBe(true);
    expect((unknown.data as { valid: boolean }).valid).toBe(false);
    expect((unknown.data as { diagnostics: Array<{ code: string; field: string }> }).diagnostics).toContainEqual(expect.objectContaining({ code: "PLANG_CATALOG_UNKNOWN_TYPE", field: "nodes[0].children[0].type" }));

    await runtime.callTool("import_component_catalog", {
      catalog: {
        version: 1,
        source: "dynamic",
        components: [{ type: "PluginSampler", role: "sampler", displayName: "Plugin Sampler", xmlTags: ["PluginSampler"], testClasses: ["PluginSampler"], guiClasses: ["PluginGui"], fields: [] }]
      }
    });
    const known = await runtime.callTool("validate_plan_language", { text });
    expect((known.data as { valid: boolean }).valid).toBe(true);
  });

  it("parses Plan Language text and recursively validates node structure", async () => {
    const runtime = new JmxplsRuntime();
    const parse = await runtime.callTool("parse_plan_language", {
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        detail: "expanded",
        name: "test",
        nodes: [{ nodeId: "root", role: "testPlan", type: "TestPlan", name: "root", enabled: true, children: [{ nodeId: "child", role: "threadGroup", type: "ThreadGroup", name: "tg", enabled: false }] }],
        warnings: []
      })
    });
    expect(parse.success).toBe(true);
    expect((parse.data as { valid: boolean }).valid).toBe(true);

    const nestedInvalid = await runtime.callTool("parse_plan_language", {
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        name: "test",
        nodes: [{ nodeId: "root", role: "testPlan", type: "TestPlan", name: "root", enabled: true, children: [{ nodeId: 1, role: "sampler", type: "HTTP", name: "sample", enabled: true }] }],
        warnings: []
      })
    });
    expect(nestedInvalid.success).toBe(true);
    expect((nestedInvalid.data as { valid: boolean }).valid).toBe(false);
    expect((nestedInvalid.data as { diagnostics: Array<{ field: string; code: string }> }).diagnostics).toContainEqual(expect.objectContaining({ field: "nodes[0].children[0].nodeId", code: "PLANG_SCHEMA_INVALID" }));

    const badSyntax = await runtime.callTool("parse_plan_language", { text: "format: [ " });
    expect(badSyntax.success).toBe(false);
  });

  it("projects Plan Language with subtree scope and redaction controls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-plan-language-options-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;
    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = ((tree.data as Array<{ nodeId: string }>)[0]?.nodeId)!;

    const added = await runtime.callTool("add_node", {
      planId,
      parentNodeId: rootNodeId,
      nodeType: "ThreadGroup",
      fields: { name: "Scoped Users", enabled: true, password: "secret-value" }
    });
    expect(added.success).toBe(true);
    const nodes = await runtime.callTool("find_nodes", { planId, name: "Scoped Users", match: "exact" });
    const scopedNodeId = ((nodes.data as Array<{ nodeId: string }>)[0]?.nodeId)!;

    const redacted = await runtime.callTool("get_plan_language", { planId, mode: "semantic", subtreeNodeId: scopedNodeId });
    expect((redacted.data as { nodes: Array<{ nodeId: string; fields: Record<string, unknown> }> }).nodes[0]?.nodeId).toBe(scopedNodeId);
    expect((redacted.data as { nodes: Array<{ fields: Record<string, unknown> }> }).nodes[0]?.fields.password).toBe("<redacted>");

    const unredacted = await runtime.callTool("get_plan_language", { planId, mode: "semantic", nodeId: scopedNodeId, redaction: "none" });
    expect((unredacted.data as { nodes: Array<{ fields: Record<string, unknown> }> }).nodes[0]?.fields.password).toBe("secret-value");

    const depthZero = await runtime.callTool("get_plan_language", { planId, depth: 0 });
    expect((depthZero.data as { nodes: Array<{ children?: unknown[] }> }).nodes[0]?.children).toBeUndefined();
  });

  it("imports Plan Language text into a new target plan", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-import-plan-language-"));
    const targetPath = join(dir, "plan.jmx");
    const runtime = new JmxplsRuntime();
    const importResult = await runtime.callTool("import_plan_language", {
      targetPath,
      mode: "patch",
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        detail: "expanded",
        name: "imported",
        nodes: [{
          nodeId: "root",
          role: "testPlan",
          type: "TestPlan",
          name: "imported plan",
          enabled: true,
          children: [{
            nodeId: "tg1",
            role: "threadGroup",
            type: "ThreadGroup",
            name: "baseline",
            enabled: true
          }]
        }],
        warnings: []
      })
    });

    expect(importResult.success).toBe(true);
    expect((importResult.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);
    const planId = (importResult.data as { planId: string }).planId;
    const threadGroups = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect(threadGroups.success).toBe(true);
    expect((threadGroups.data as Array<{ name: string }>).length).toBe(1);
    expect((threadGroups.data as Array<{ name: string }>)[0]?.name).toBe("baseline");
    expect(existsSync(targetPath)).toBe(true);
  });

  it("imports Plan Language in new mode only to a fresh target", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-import-plan-language-new-"));
    const targetPath = join(dir, "plan.jmx");
    const text = JSON.stringify({
      format: "jmxpls-plan-language",
      version: 1,
      mode: "outline",
      detail: "expanded",
      name: "new-import",
      nodes: [{
        nodeId: "root",
        role: "testPlan",
        type: "TestPlan",
        name: "new import",
        enabled: true,
        children: [{
          nodeId: "tg-new",
          role: "threadGroup",
          type: "ThreadGroup",
          name: "new-mode",
          enabled: true
        }]
      }],
      warnings: []
    });

    const runtime = new JmxplsRuntime();
    const imported = await runtime.callTool("import_plan_language", { targetPath, mode: "new", text });
    expect(imported.success).toBe(true);
    expect((imported.data as { mode: string; validation?: { valid: boolean } }).mode).toBe("new");
    expect((imported.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);

    const duplicate = await runtime.callTool("import_plan_language", { targetPath, mode: "new", text });
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain("targetPath already exists");
  });

  it("imports Plan Language from a file path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-import-plan-language-file-"));
    const inputPath = join(dir, "source-plan-language.json");
    const targetPath = join(dir, "plan.jmx");
    writeFileSync(inputPath, JSON.stringify({
      format: "jmxpls-plan-language",
      version: 1,
      mode: "outline",
      detail: "expanded",
      name: "imported-from-file",
      nodes: [{
        nodeId: "root",
        role: "testPlan",
        type: "TestPlan",
        name: "imported from file",
        enabled: true,
        children: [{
          nodeId: "tg-from-file",
          role: "threadGroup",
          type: "ThreadGroup",
          name: "tg-from-file",
          enabled: true
        }]
      }],
      warnings: []
    }));

    const runtime = new JmxplsRuntime();
    const importResult = await runtime.callTool("import_plan_language", {
      path: inputPath,
      targetPath,
      mode: "patch"
    });

    expect(importResult.success).toBe(true);
    expect((importResult.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);
    const planId = (importResult.data as { planId: string }).planId;
    const threadGroups = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect(threadGroups.success).toBe(true);
    expect((threadGroups.data as Array<{ name: string }>).length).toBe(1);
    expect((threadGroups.data as Array<{ name: string }>)[0]?.name).toBe("tg-from-file");
  });

  it("replaces an applied plan in replace mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-apply-plan-language-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;

    const added = await runtime.callTool("apply_plan_language", {
      planId,
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        detail: "expanded",
        name: "before",
        nodes: [{
          nodeId: "root",
          role: "testPlan",
          type: "TestPlan",
          name: "Minimal Plan",
          enabled: true,
          children: [{
            nodeId: "keep",
            role: "threadGroup",
            type: "ThreadGroup",
            name: "keep",
            enabled: true
          }]
        }],
        warnings: []
      })
    });
    expect(added.success).toBe(true);
    expect((added.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);
    const beforeReplace = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect((beforeReplace.data as Array<{ name: string }>).map((node) => node.name)).toContain("keep");

    const replaced = await runtime.callTool("apply_plan_language", {
      planId,
      mode: "replace",
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        detail: "expanded",
        name: "after",
        nodes: [{
          nodeId: "root",
          role: "testPlan",
          type: "TestPlan",
          name: "Minimal Plan",
          enabled: true,
          children: [{
            nodeId: "replace",
            role: "threadGroup",
            type: "ThreadGroup",
            name: "replaced",
            enabled: true
          }]
        }],
        warnings: []
      })
    });
    expect(replaced.success).toBe(true);
    expect((replaced.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);
    const threadGroups = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect((threadGroups.data as Array<{ name: string; nodeId: string }>).length).toBe(1);
    expect((threadGroups.data as Array<{ name: string; nodeId: string }>)[0]?.name).toBe("replaced");
  });

  it("merges applied Plan Language while preserving existing nodes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-apply-plan-language-merge-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;

    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = (tree.data as Array<{ nodeId: string }>)[0]?.nodeId;
    const seeded = await runtime.callTool("add_node", {
      planId,
      parentNodeId: rootNodeId,
      nodeType: "ThreadGroup",
      fields: { name: "seed", enabled: true, "ThreadGroup.num_threads": 1, "ThreadGroup.ramp_time": 0 }
    });
    expect(seeded.success).toBe(true);

    const beforeMerge = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect((beforeMerge.data as Array<{ name: string }>).length).toBe(1);

    const merged = await runtime.callTool("apply_plan_language", {
      planId,
      mode: "merge",
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        detail: "expanded",
        name: "before",
        nodes: [{
          nodeId: "root",
          role: "testPlan",
          type: "TestPlan",
          name: "Minimal Plan",
          enabled: true,
          children: [{
            nodeId: "added",
            role: "controller",
            type: "GenericController",
            name: "added",
            enabled: true
          }]
        }],
        warnings: []
      })
    });
    expect(merged.success).toBe(true);
    expect((merged.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);
    const afterMerge = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect((afterMerge.data as Array<{ name: string; nodeId: string }>).length).toBe(1);
    expect((afterMerge.data as Array<{ name: string; nodeId: string }>).map((node) => node.name)).toContain("seed");
    const controllers = await runtime.callTool("find_nodes", { planId, role: "controller" });
    expect((controllers.data as Array<{ name: string; nodeId: string }>).length).toBe(1);
    expect((controllers.data as Array<{ name: string; nodeId: string }>)[0]?.name).toBe("added");
  });

  it("paginates large tree views and returns suggested next resources", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-large-tree-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;
    expect((opened.data as { nextSuggestedResources: string[] }).nextSuggestedResources).toContain(`jmxpls://plans/${planId}/tree?limit=50&depth=2`);

    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = (tree.data as Array<{ nodeId: string }>)[0]?.nodeId;
    expect(rootNodeId).toBeTruthy();

    const seeded = await runtime.callTool("apply_semantic_patch", {
      planId,
      operations: Array.from({ length: 6 }, (_, index) => ({
        op: "addNode",
        parentNodeId: rootNodeId,
        nodeType: "ThreadGroup",
        fields: { name: `users-${index}`, enabled: true, "ThreadGroup.num_threads": 1 }
      }))
    });
    expect(seeded.success).toBe(true);

    const firstPage = await runtime.callTool("list_tree", { planId, limit: 3, depth: 1 });
    expect(firstPage.success).toBe(true);
    expect((firstPage.data as { items: unknown[] }).items).toHaveLength(3);
    expect((firstPage.data as { total: number }).total).toBe(7);
    expect((firstPage.data as { nextCursor: string }).nextCursor).toBe("3");

    const budgeted = await runtime.callTool("list_tree", { planId, limit: 7, depth: 1, byteBudget: 600 });
    expect(budgeted.success).toBe(true);
    expect((budgeted.data as { items: unknown[] }).items.length).toBeLessThan(7);
    expect((budgeted.data as { truncatedByBudget: boolean }).truncatedByBudget).toBe(true);
    expect((budgeted.data as { nextCursor: string }).nextCursor).toBeTruthy();

    const subtree = await runtime.callTool("list_tree", { planId, subtreeNodeId: rootNodeId, depth: 0 });
    expect((subtree.data as { items: Array<{ nodeId: string }>; total: number }).items).toEqual([{ nodeId: rootNodeId, depth: 0, path: expect.any(String), role: "testPlan", type: "TestPlan", name: "Minimal Plan", enabled: true, childCount: 6, hasChildren: true, nextSuggestedResources: expect.any(Array) }]);
    expect((subtree.data as { total: number }).total).toBe(1);

    const secondPage = runtime.readResource(`jmxpls://plans/${planId}/tree?limit=3&cursor=3&depth=1`);
    expect(secondPage.success).toBe(true);
    expect((secondPage.data as { items: unknown[] }).items).toHaveLength(3);

    const children = runtime.readResource(`jmxpls://plans/${planId}/node/${rootNodeId}/children?limit=2`);
    expect(children.success).toBe(true);
    expect((children.data as { items: unknown[]; nextCursor: string }).items).toHaveLength(2);
    expect((children.data as { nextCursor: string }).nextCursor).toBe("2");

    const found = await runtime.callTool("find_nodes", { planId, role: "threadGroup", limit: 2 });
    expect((found.data as { items: unknown[]; nextCursor: string }).items).toHaveLength(2);
    expect((found.data as { nextSuggestedResources: string[] }).nextSuggestedResources[0]).toContain("cursor=2");
  });

  it("finds nodes by match mode, subtree scope, and result view", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-find-nodes-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    const planId = (opened.data as { planId: string }).planId;

    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = ((tree.data as Array<{ nodeId: string }>)[0]?.nodeId)!;
    await runtime.callTool("add_node", { planId, parentNodeId: rootNodeId, nodeType: "ThreadGroup", fields: { name: "Checkout Users", enabled: true } });

    const threadGroups = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    const checkoutId = (threadGroups.data as Array<{ name: string; nodeId: string }>).find((node) => node.name === "Checkout Users")?.nodeId;
    expect(checkoutId).toBeDefined();
    await runtime.callTool("add_http_request", { planId, parentNodeId: checkoutId, method: "GET", domain: "${apiHost}", path: "/checkout" });
    await runtime.callTool("add_node", { planId, parentNodeId: checkoutId, nodeType: "com.example.CustomSampler", fields: { name: "Custom Plugin Sampler", enabled: true, classname: "com.example.CustomSampler", customField: "custom-value" } });

    const exact = await runtime.callTool("find_nodes", { planId, name: "Checkout Users", match: "exact" });
    expect((exact.data as Array<{ name: string }>).map((node) => node.name)).toEqual(["Checkout Users"]);

    const regex = await runtime.callTool("find_nodes", { planId, name: "^GET /check", match: "regex" });
    expect((regex.data as Array<{ name: string }>).map((node) => node.name)).toEqual(["GET /checkout"]);

    const fuzzy = await runtime.callTool("find_nodes", { planId, name: "chekout", match: "fuzzy" });
    expect((fuzzy.data as Array<{ name: string }>).map((node) => node.name)).toContain("Checkout Users");

    const compact = await runtime.callTool("find_nodes", { planId, role: "sampler", subtreeNodeId: checkoutId, view: "compact" });
    const compactItems = (compact.data as { items: Array<{ name: string; fields?: unknown }> }).items;
    expect(compactItems).toEqual([expect.objectContaining({ name: "GET /checkout" })]);
    expect(compactItems[0]?.fields).toBeUndefined();

    const full = await runtime.callTool("find_nodes", { planId, role: "sampler", subtreeNodeId: checkoutId, view: "full" });
    expect((full.data as { items: Array<{ children?: unknown[]; fields: Record<string, unknown> }> }).items[0]).toEqual(expect.objectContaining({ fields: expect.any(Object), children: expect.any(Array) }));

    const raw = await runtime.callTool("find_nodes", { planId, role: "sampler", subtreeNodeId: checkoutId, view: "raw" });
    expect((raw.data as { items: Array<{ rawRef: string }> }).items[0]?.rawRef).toContain("jmxpls://raw/");

    const byPath = await runtime.callTool("find_nodes", { planId, path: "/ThreadGroup" });
    expect((byPath.data as Array<{ name: string }>).map((node) => node.name)).toContain("Checkout Users");

    const byVariable = await runtime.callTool("find_nodes", { planId, variable: "apiHost" });
    expect((byVariable.data as Array<{ name: string }>).map((node) => node.name)).toContain("GET /checkout");

    const byRequest = await runtime.callTool("find_nodes", { planId, method: "GET", requestPath: "/checkout", domain: "apiHost" });
    expect((byRequest.data as Array<{ name: string }>).map((node) => node.name)).toEqual(["GET /checkout"]);

    const byPlugin = await runtime.callTool("find_nodes", { planId, pluginClass: "com.example.CustomSampler", field: "customField", fieldValue: "custom-value" });
    expect((byPlugin.data as Array<{ name: string }>).map((node) => node.name)).toEqual(["Custom Plugin Sampler"]);

    const byParent = await runtime.callTool("find_nodes", { planId, parentName: "Checkout Users", requestPath: "/checkout" });
    expect((byParent.data as Array<{ name: string }>).map((node) => node.name)).toEqual(["GET /checkout"]);

    const byChild = await runtime.callTool("find_nodes", { planId, name: "Checkout Users", childType: "HTTPSamplerProxy" });
    expect((byChild.data as Array<{ name: string }>).map((node) => node.name)).toEqual(["Checkout Users"]);
  });

  it("preserves unknown plugin nodes through move and save", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-unknown-plugin-"));
    const planPath = join(dir, "unknown-plugin.jmx");
    copyFileSync(resolve(root, "fixtures/plugins/unknown-plugin.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;

    const unknownNodes = await runtime.callTool("find_nodes", { planId, type: "com.example.UnknownPlugin" });
    const unknownNodeId = (unknownNodes.data as Array<{ nodeId: string }>)[0]?.nodeId;
    expect(unknownNodeId).toBeTruthy();

    const testPlan = await runtime.callTool("add_node", {
      planId,
      parentNodeId: "root",
      nodeType: "TestPlan",
      fields: { name: "Plugin Preservation Harness", enabled: true, guiClass: "TestPlanGui" }
    });
    expect(testPlan.success).toBe(true);

    const testPlans = await runtime.callTool("find_nodes", { planId, type: "TestPlan" });
    const testPlanNodeId = (testPlans.data as Array<{ nodeId: string }>)[0]?.nodeId;
    expect(testPlanNodeId).toBeTruthy();

    const moved = await runtime.callTool("move_node", { planId, nodeId: unknownNodeId, toParentNodeId: testPlanNodeId });
    expect(moved.success).toBe(true);

    const saved = await runtime.callTool("save_plan", { planId, backup: false });
    expect(saved.success).toBe(true);
    expect(readFileSync(planPath, "utf8")).toContain("<stringProp name=\"custom.value\">kept</stringProp>");

    const reopened = await runtime.callTool("reload_plan", { planId });
    expect(reopened.success).toBe(true);
    const reopenedPlanId = (reopened.data as { planId: string }).planId;
    const preserved = await runtime.callTool("find_nodes", { planId: reopenedPlanId, type: "com.example.UnknownPlugin" });
    const preservedNode = (preserved.data as Array<{ nodeId: string; fields: { properties: Array<{ name: string; value: string }> } }>)[0];
    expect(preservedNode?.fields.properties).toContainEqual(expect.objectContaining({ name: "custom.value", value: "kept" }));
  });

  it("supports dry-run plan-language application without mutating sessions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-apply-plan-language-dry-run-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;

    const applied = await runtime.callTool("apply_plan_language", {
      planId,
      mode: "merge",
      dryRun: true,
      text: JSON.stringify({
        format: "jmxpls-plan-language",
        version: 1,
        mode: "outline",
        detail: "expanded",
        name: "dryrun",
        nodes: [{
          nodeId: "root",
          role: "testPlan",
          type: "TestPlan",
          name: "Minimal Plan",
          enabled: true,
          children: [{
            nodeId: "dry",
            role: "threadGroup",
            type: "ThreadGroup",
            name: "dry",
            enabled: true
          }]
        }],
        warnings: []
      })
    });
    expect(applied.success).toBe(true);

    const threadGroups = await runtime.callTool("find_nodes", { planId, role: "threadGroup" });
    expect((threadGroups.data as Array<{ name: string }>).length).toBe(0);
    expect(readFileSync(planPath, "utf8")).toContain("<TestPlan ");
  });

  it("validates semantic and raw edits by default", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-safe-edits-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;
    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = ((tree.data as Array<{ nodeId: string }>)[0]?.nodeId)!;

    const semantic = await runtime.callTool("add_node", {
      planId,
      parentNodeId: rootNodeId,
      nodeType: "ThreadGroup",
      fields: { name: "Validated Users", enabled: true }
    });
    expect(semantic.success).toBe(true);
    expect((semantic.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);

    const raw = await runtime.callTool("update_raw_property", {
      planId,
      nodeId: rootNodeId,
      propertyPath: "name",
      value: "Raw Unsafe Name"
    });
    expect(raw.success).toBe(true);
    expect((raw.data as { validation?: { valid: boolean } }).validation?.valid).toBe(true);
  });

  it("returns a configured diagnostic for path-based JMeter validation without a bridge", async () => {
    const previousJar = process.env.JMXPLS_JAVA_BRIDGE_JAR;
    delete process.env.JMXPLS_JAVA_BRIDGE_JAR;
    try {
      const runtime = new JmxplsRuntime();
      const environment = await runtime.callTool("get_jmeter_environment");
      expect(environment.success).toBe(true);
      expect((environment.data as { bridgeConfigured: boolean }).bridgeConfigured).toBe(false);
      expect((environment.data as { diagnostics: Array<{ code: string }> }).diagnostics[0]?.code).toBe("JMX_JMETER_BRIDGE_NOT_CONFIGURED");

      const result = await runtime.callTool("validate_with_jmeter", { path: "plan.jmx", strict: true });

      expect(result.success).toBe(true);
      expect((result.data as { jmeterBacked: boolean }).jmeterBacked).toBe(false);
      expect((result.data as { valid: boolean }).valid).toBe(false);
      expect((result.data as { diagnostics: Array<{ code: string }> }).diagnostics[0]?.code).toBe("JMX_JMETER_BRIDGE_NOT_CONFIGURED");
      expect((result.data as { nextSuggestedResources: string[] }).nextSuggestedResources).toContain("jmxpls://audit");
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
      "  const data = request.command === \"environment\" ? { javaVersion: \"stub-java\", jmeterConfigured: true } : { path: request.path, valid: true };",
      "  process.stdout.write(JSON.stringify({ id: request.id, success: true, data, diagnostics: [] }) + \"\\n\");",
      "});"
    ].join("\n"));
    chmodSync(scriptPath, 0o755);

    process.env.JMXPLS_JAVA_BRIDGE_JAR = join(dir, "bridge.jar");
    process.env.JMXPLS_JAVA_COMMAND = scriptPath;
    try {
      const runtime = new JmxplsRuntime();
      const environment = await runtime.callTool("get_jmeter_environment");
      expect(environment.success).toBe(true);
      expect((environment.data as { bridgeConfigured: boolean }).bridgeConfigured).toBe(true);
      expect((environment.data as { valid: boolean }).valid).toBe(true);
      expect((environment.data as { environment: { javaVersion: string } }).environment.javaVersion).toBe("stub-java");

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

      const roundTripResult = await runtime.callTool("roundtrip_validate", { planId });
      expect(roundTripResult.success).toBe(true);
      expect((roundTripResult.data as { jmeterBacked: boolean }).jmeterBacked).toBe(true);
      expect((roundTripResult.data as { valid: boolean }).valid).toBe(true);
      expect((roundTripResult.data as { path: string }).path).toBe(planPath);
      expect((roundTripResult.data as { mode: string }).mode).toBe("loadSaveReload");
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

  it("returns suggested resources for session JMeter validation fallback", async () => {
    const previousJar = process.env.JMXPLS_JAVA_BRIDGE_JAR;
    delete process.env.JMXPLS_JAVA_BRIDGE_JAR;
    try {
      const dir = mkdtempSync(join(tmpdir(), "jmxpls-bridge-fallback-"));
      const planPath = join(dir, "minimal.jmx");
      copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);
      const runtime = new JmxplsRuntime();
      const opened = await runtime.callTool("open_plan", { path: planPath });
      const planId = (opened.data as { planId: string }).planId;

      const result = await runtime.callTool("validate_with_jmeter", { planId });

      expect(result.success).toBe(true);
      expect((result.data as { jmeterBacked: boolean }).jmeterBacked).toBe(false);
      expect((result.data as { nextSuggestedResources: string[] }).nextSuggestedResources).toContain(`jmxpls://plans/${planId}/diagnostics`);
    } finally {
      if (previousJar === undefined) {
        delete process.env.JMXPLS_JAVA_BRIDGE_JAR;
      } else {
        process.env.JMXPLS_JAVA_BRIDGE_JAR = previousJar;
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

  it("executes JMeter runs when explicitly requested", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-exec-real-"));
    const planPath = join(dir, "plan.jmx");
    const jtlPath = join(dir, "results.jtl");
    const executable = join(dir, "jmeter");
    writeFileSync(planPath, "<jmeterTestPlan />");
    writeFileSync(executable, "#!/bin/sh\nwhile [ \"$#\" -gt 0 ]; do\n  if [ \"$1\" = \"-l\" ]; then\n    shift\n    printf 'elapsed,label,responseCode,success\\n42,GET /,200,true\\n' > \"$1\"\n  fi\n  shift\ndone\necho executed-jmeter\n");
    chmodSync(executable, 0o755);

    const runtime = new JmxplsRuntime();
    const result = await runtime.callTool("run_jmeter", { planPath, jtlPath, jmeterExecutable: executable, execute: true });
    expect(result.success).toBe(true);
    expect((result.data as { executionMode: string; run: { status: string; logs: string[] } }).executionMode).toBe("executed");
    expect((result.data as { run: { status: string } }).run.status).toBe("completed");
    expect((result.data as { run: { logs: string[] } }).run.logs).toContain("stdout: executed-jmeter");
    expect(readFileSync(jtlPath, "utf8")).toContain("GET /");
  });

  it("executes JMeter HTML report generation when explicitly requested", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-report-real-"));
    const jtlPath = join(dir, "results.jtl");
    const reportDir = join(dir, "dashboard");
    const executable = join(dir, "jmeter");
    writeFileSync(jtlPath, "elapsed,label,responseCode,success\n42,GET /,200,true\n");
    writeFileSync(executable, "#!/bin/sh\nwhile [ \"$#\" -gt 0 ]; do\n  if [ \"$1\" = \"-o\" ]; then\n    shift\n    mkdir -p \"$1\"\n    printf '<html>dashboard</html>\\n' > \"$1/index.html\"\n  fi\n  shift\ndone\necho report-generated\n");
    chmodSync(executable, 0o755);

    const runtime = new JmxplsRuntime();
    const result = await runtime.callTool("generate_html_report", { jtlPath, outputDir: reportDir, jmeterExecutable: executable, execute: true });
    expect(result.success).toBe(true);
    expect((result.data as { executionMode: string }).executionMode).toBe("executed");
    expect((result.data as { run: { status: string; artifacts: string[]; logs: string[] } }).run.status).toBe("completed");
    expect((result.data as { run: { artifacts: string[] } }).run.artifacts).toContain(reportDir);
    expect((result.data as { run: { logs: string[] } }).run.logs).toContain("stdout: report-generated");
    expect(readFileSync(join(reportDir, "index.html"), "utf8")).toContain("dashboard");
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
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-template-"));
    const planPath = join(dir, "minimal.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);
    const runtime = new JmxplsRuntime();
    const opened = await runtime.callTool("open_plan", { path: planPath });
    expect(opened.success).toBe(true);
    const planId = (opened.data as { planId: string }).planId;
    const tree = await runtime.callTool("list_tree", { planId });
    const rootNodeId = ((tree.data as Array<{ nodeId: string }>)[0]?.nodeId)!;

    const templates = await runtime.callTool("list_templates");
    expect((templates.data as Array<{ name: string }>).some((template) => template.name === "http_api_baseline")).toBe(true);
    expect((templates.data as Array<{ name: string }>).some((template) => template.name === "crud_api_flow")).toBe(true);
    expect((templates.data as Array<{ name: string }>).some((template) => template.name === "jdbc_query_test")).toBe(true);

    const template = await runtime.callTool("get_template", { name: "http_api_baseline" });
    expect((template.data as { patch: { operations: unknown[] } }).patch.operations).toHaveLength(4);

    const instantiated = await runtime.callTool("instantiate_template", { name: "http_api_baseline", planId, dryRun: true });
    const patch = (instantiated.data as { patch: { dryRun: boolean; operations: Array<{ parentNodeId?: string }> } }).patch;
    expect(patch.dryRun).toBe(true);
    expect(patch.operations[0]?.parentNodeId).toBe(rootNodeId);

    const alias = await runtime.callTool("create_bearer_token_flow");
    expect((alias.data as { name: string }).name).toBe("http_api_login_bearer_token");

    const crudAlias = await runtime.callTool("create_crud_flow");
    expect((crudAlias.data as { name: string }).name).toBe("crud_api_flow");
  });
});
