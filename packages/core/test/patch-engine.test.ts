import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { SemanticPlan } from "../src/index.js";
import { applyCanonicalPatch, applySemanticPatch, loadXml, parseHashTreeDocument } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

const plan: SemanticPlan = {
  name: "Plan",
  root: [
    {
      nodeId: "node-1",
      path: "/node-1",
      role: "testPlan",
      type: "TestPlan",
      name: "Plan",
      enabled: true,
      fields: {},
      children: [],
      rawRef: "jmxpls://raw/node-1"
    }
  ],
  indexes: { byId: {}, byName: {}, byRole: {}, byType: {}, variables: {} },
  warnings: []
};

describe("applySemanticPatch", () => {
  it("supports dry-run without mutating returned plan", () => {
    const result = applySemanticPatch(plan, {
      dryRun: true,
      operations: [{ op: "setEnabled", nodeId: "node-1", enabled: false }]
    });

    expect(result.plan.root[0]?.enabled).toBe(true);
    expect(result.diff.changes[0]?.kind).toBe("node.enabledChanged");
  });

  it("commits enabled changes", () => {
    const result = applySemanticPatch(plan, {
      operations: [{ op: "setEnabled", nodeId: "node-1", enabled: false }]
    });

    expect(result.plan.root[0]?.enabled).toBe(false);
  });
});

describe("applyCanonicalPatch", () => {
  it("uses addNode nodeId for later operations in the same patch", () => {
    const document = parseHashTreeDocument(loadXml(readFileSync(resolve(root, "fixtures/jmx/minimal.jmx"))));
    const result = applyCanonicalPatch(document, {
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: "template-thread-group", nodeType: "ThreadGroup", fields: { name: "Template Users", guiClass: "ThreadGroupGui" } },
        { op: "addNode", parentNodeId: "template-thread-group", nodeId: "template-request", nodeType: "HTTPSamplerProxy", fields: { name: "GET /health", guiClass: "HttpTestSampleGui", "HTTPSampler.method": "GET", "HTTPSampler.path": "/health" } }
      ]
    });

    const threadGroup = result.after.root.find((node) => node.nodeId === "template-thread-group");
    expect(threadGroup?.children[0]?.nodeId).toBe("template-request");
  });
});
