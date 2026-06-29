import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSemanticPlan, executionFlow, loadXml, parseHashTreeDocument, summarizePlan } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("semantic plan", () => {
  it("indexes and summarizes a minimal JMX", () => {
    const canonical = parseHashTreeDocument(loadXml(readFileSync(resolve(root, "fixtures/jmx/minimal.jmx"))));
    const plan = buildSemanticPlan(canonical, "plan-1");
    const summary = summarizePlan(plan);

    expect(plan.planId).toBe("plan-1");
    expect(summary.name).toBe("Minimal Plan");
    expect(summary.nodeCount).toBe(1);
    expect(executionFlow(plan)[0]?.name).toBe("Minimal Plan");
  });
});
