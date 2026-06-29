import { describe, expect, it } from "vitest";

import type { SemanticPlan } from "../src/index.js";
import { applySemanticPatch } from "../src/index.js";

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
