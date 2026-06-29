import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadSidecar, reconcileSidecar, saveSidecar } from "../src/index.js";

describe("sidecar store", () => {
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
    writeFileSync(`${planPath}.jmxpls.meta.json`, "not json");

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
});
