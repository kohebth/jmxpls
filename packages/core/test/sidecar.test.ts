import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { flattenSemanticNodes, loadSidecar, reconcileSidecar, saveSidecar, SessionManager, sidecarPathFor } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("sidecar store", () => {
  it("uses jmxpls sidecar filenames next to JMX files", () => {
    expect(sidecarPathFor("/plans/load.jmx")).toBe("/plans/load.jmxpls.meta.json");
  });

  it("loads missing sidecars without diagnostics", async () => {
    const result = await loadSidecar("/tmp/does-not-exist.jmx");

    expect(result.sidecar).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it("saves and reloads sidecars", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-"));
    const planPath = join(dir, "plan.jmx");
    await saveSidecar(planPath, [{ nodeId: "node-1", jmxPath: "/root", fingerprint: "abc" }]);

    const result = await loadSidecar(planPath);

    expect(result.sidecar?.nodes[0]?.nodeId).toBe("node-1");
  });

  it("warns on corrupt sidecars", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-"));
    const planPath = join(dir, "plan.jmx");
    writeFileSync(sidecarPathFor(planPath), "not json");

    const result = await loadSidecar(planPath);

    expect(result.diagnostics[0]?.code).toBe("JMX_SIDECAR_CORRUPT");
  });

  it("reconciles matching fingerprints", () => {
    const reconciled = reconcileSidecar(
      {
        schemaVersion: 1,
        sourcePath: "plan.jmx",
        updatedAt: new Date().toISOString(),
        nodes: [{ nodeId: "stable", jmxPath: "/old", fingerprint: "abc" }]
      },
      [{ nodeId: "new", jmxPath: "/new", fingerprint: "abc" }]
    );

    expect(reconciled[0]?.nodeId).toBe("stable");
  });

  it("saves sidecars and reapplies stable node IDs on reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-sidecar-session-"));
    const planPath = join(dir, "plan.jmx");
    copyFileSync(resolve(root, "fixtures/jmx/minimal.jmx"), planPath);

    const sessions = new SessionManager();
    const session = await sessions.openPlan(planPath);
    const rootNodeId = session.semanticPlan().root[0]?.nodeId;
    expect(rootNodeId).toBeTruthy();
    session.applyPatch({
      operations: [{
        op: "addNode",
        parentNodeId: rootNodeId!,
        nodeId: "stable-users",
        nodeType: "ThreadGroup",
        fields: { name: "Stable Users", enabled: true }
      }]
    });

    const saved = await session.save(planPath, false);
    expect(saved.sidecarPath).toBe(sidecarPathFor(planPath));

    const reopened = await new SessionManager().openPlan(planPath);
    const nodeIds = flattenSemanticNodes(reopened.semanticPlan().root).map((node) => node.nodeId);
    expect(nodeIds).toContain("stable-users");
  });
});
